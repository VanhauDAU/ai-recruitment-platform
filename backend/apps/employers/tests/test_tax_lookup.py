from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import User

from ..models import (
    Company,
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerVerificationCase,
    RecruiterProfile,
)
from ..services import get_or_create_verification_case, record_verification_upload
from ..services.tax_lookup import (
    TaxLookupRateLimited,
    TaxLookupResult,
    lookup_company_tax,
    queue_company_tax_lookup,
)
from ..tasks.tax_lookup import lookup_company_tax_evidence


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    VIETQR_TAX_LOOKUP_ENABLED=True,
    VIETQR_TAX_LOOKUP_BASE_URL='https://api.vietqr.io/v2/business',
    VIETQR_TAX_LOOKUP_CONNECT_TIMEOUT=2,
    VIETQR_TAX_LOOKUP_READ_TIMEOUT=3,
    VIETQR_TAX_LOOKUP_SUCCESS_TTL=86400,
    VIETQR_TAX_LOOKUP_NEGATIVE_TTL=900,
)
class CompanyTaxLookupTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='tax-lookup@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Công ty Casso',
            tax_code='0316794479',
            created_by=self.user,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
            registration_completed_at=timezone.now(),
        )

    @patch('apps.employers.services.tax_lookup.requests.get')
    def test_lookup_normalizes_success_and_uses_cache(self, get):
        response = Mock(status_code=200, headers={})
        response.json.return_value = {
            'code': '00',
            'desc': 'Success',
            'data': {
                'id': '0316794479',
                'name': 'CÔNG TY TNHH CASSO',
                'internationalName': 'CASSO COMPANY LIMITED',
                'shortName': 'CASSO',
                'address': 'Thành phố Hồ Chí Minh',
            },
        }
        get.return_value = response

        first = lookup_company_tax('0316794479')
        second = lookup_company_tax('0316794479')

        self.assertEqual(first.status, CompanyTaxLookupEvidence.Status.FOUND)
        self.assertEqual(first.registered_name, 'CÔNG TY TNHH CASSO')
        self.assertEqual(first.response_hash, second.response_hash)
        get.assert_called_once()

    @patch('apps.employers.services.tax_lookup.cache.set', side_effect=ConnectionError)
    @patch('apps.employers.services.tax_lookup.cache.get', side_effect=ConnectionError)
    @patch('apps.employers.services.tax_lookup.requests.get')
    def test_lookup_continues_when_cache_is_unavailable(self, get, _cache_get, _cache_set):
        response = Mock(status_code=200, headers={})
        response.json.return_value = {
            'code': '00',
            'desc': 'Success',
            'data': {
                'id': '0316794479',
                'name': 'CÔNG TY TNHH CASSO',
                'address': 'Thành phố Hồ Chí Minh',
            },
        }
        get.return_value = response

        result = lookup_company_tax('0316794479')

        self.assertEqual(result.status, CompanyTaxLookupEvidence.Status.FOUND)
        get.assert_called_once()

    @patch('apps.employers.services.tax_lookup.requests.get')
    def test_lookup_rejects_mismatched_returned_tax_code(self, get):
        response = Mock(status_code=200, headers={})
        response.json.return_value = {
            'code': '00',
            'desc': 'Success',
            'data': {'id': '0100000000', 'name': 'Sai doanh nghiệp'},
        }
        get.return_value = response

        result = lookup_company_tax('0316794479')

        self.assertEqual(result.status, CompanyTaxLookupEvidence.Status.INVALID_RESPONSE)
        self.assertEqual(result.returned_tax_code, '0100000000')

    @patch('apps.employers.services.tax_lookup.requests.get')
    def test_lookup_surfaces_provider_rate_limit(self, get):
        get.return_value = Mock(status_code=429, headers={'Retry-After': '15'})

        with self.assertRaises(TaxLookupRateLimited) as raised:
            lookup_company_tax('0316794479')

        self.assertEqual(raised.exception.retry_after, 15)

    @patch('apps.employers.tasks.tax_lookup.lookup_company_tax')
    def test_task_updates_pending_evidence(self, provider):
        case = get_or_create_verification_case(self.recruiter)
        evidence = CompanyTaxLookupEvidence.objects.create(
            company=self.company,
            verification_case=case,
            requested_by=self.user,
            workflow_revision=case.revision,
            tax_code=self.company.tax_code,
            submitted_company_name=self.company.company_name,
        )
        provider.return_value = TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.FOUND,
            returned_tax_code=self.company.tax_code,
            registered_name='CÔNG TY TNHH CASSO',
            response_hash='a' * 64,
        )

        lookup_company_tax_evidence.apply(args=[evidence.pk]).get()

        evidence.refresh_from_db()
        self.assertEqual(evidence.status, CompanyTaxLookupEvidence.Status.FOUND)
        self.assertIsNotNone(evidence.completed_at)

    @patch(
        'apps.employers.tasks.tax_lookup.lookup_company_tax_evidence.delay',
        side_effect=ConnectionError,
    )
    def test_queue_marks_evidence_unavailable_when_broker_is_down(self, _delay):
        case = get_or_create_verification_case(self.recruiter)

        with self.captureOnCommitCallbacks(execute=True):
            evidence = queue_company_tax_lookup(
                company=self.company,
                requested_by=self.user,
                verification_case=case,
                workflow_revision=case.revision,
            )

        evidence.refresh_from_db()
        self.assertEqual(evidence.status, CompanyTaxLookupEvidence.Status.UNAVAILABLE)
        self.assertEqual(
            evidence.provider_description,
            'Không thể xếp lịch tra cứu VietQR.',
        )

    def test_verification_submission_creates_one_evidence_per_revision(self):
        case = get_or_create_verification_case(self.recruiter)
        first = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            verification_case=case,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/company/business.pdf',
        )
        record_verification_upload(
            recruiter=self.recruiter,
            document=first,
            verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
        )
        second = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            verification_case=case,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url='employers/company/dpa.pdf',
        )
        record_verification_upload(recruiter=self.recruiter, document=second)

        case.refresh_from_db()
        evidence = case.tax_lookup_evidences.get(workflow_revision=case.revision)
        self.assertEqual(evidence.tax_code, self.company.tax_code)
        self.assertEqual(
            case.tax_lookup_evidences.filter(workflow_revision=case.revision).count(),
            1,
        )
