"""Creating a company and joining an existing one."""

import shutil
import tempfile
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import SimpleRateThrottle

from common.storage.r2 import private_media_storage

from ..models import (
    Company,
    CompanyDocument,
    CompanyJoinRequest,
    EmployerNotification,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
from ..services import decide_company_join
from .factories import (
    DOCX_BYTES,
    PNG_BYTES,
    TEST_MEDIA_ROOT,
    authenticate_employer,
    company_payload,
    make_recruiter,
    make_verified_representative,
)


class CompanyCreateTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_recruiter()
        self.industry = Industry.objects.create(name='Công nghệ thông tin')
        authenticate_employer(self.client, self.user)

    def test_create_company_links_recruiter_as_owner_without_verification_fields(self):
        response = self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        for removed_field in (
            'verification_status',
            'verification_source',
            'verified_at',
            'rejected_reason',
        ):
            self.assertNotIn(removed_field, response.data)

        self.recruiter.refresh_from_db()
        company = self.recruiter.company
        self.assertEqual(company.company_name, 'Acme Corp')
        self.assertEqual(self.recruiter.company_role, RecruiterProfile.CompanyRole.OWNER)
        self.assertTrue(company.company_industries.get(industry=self.industry).is_primary)

    def test_create_does_not_require_verified_phone(self):
        user, _ = make_recruiter('newbie@example.com', phone_verified=False)
        authenticate_employer(self.client, user)
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, tax_code='0207654321'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_create_with_password_session(self):
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_primary_industry_must_be_among_selected(self):
        other = Industry.objects.get(name='Bảo hiểm')
        payload = company_payload(self.industry, primary_industry=other.id)
        response = self.client.post(reverse('employer-company-create'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_change_company_once_linked(self):
        self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, tax_code='0207654321'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_tax_code_and_company_name_are_accepted_without_verification_claim(self):
        self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        user2, _ = make_recruiter('hr2@example.com')
        authenticate_employer(self.client, user2)
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, company_name='Acme Fake'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        duplicate = Company.objects.get(public_id=response.data['public_id'])
        self.assertEqual(duplicate.tax_code, '0101234567')

        user3, _ = make_recruiter('hr3@example.com')
        authenticate_employer(self.client, user3)
        same_name_response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry),
            format='json',
        )
        self.assertEqual(
            same_name_response.status_code,
            status.HTTP_201_CREATED,
            same_name_response.data,
        )
        self.assertEqual(
            Company.objects.filter(
                tax_code='0101234567',
                company_name='Acme Corp',
            ).count(),
            2,
        )
        original = Company.objects.get(created_by=self.user)
        same_name = Company.objects.get(public_id=same_name_response.data['public_id'])
        self.assertNotEqual(original.slug, same_name.slug)

    def test_numeric_tax_code_and_rich_text_are_sanitized(self):
        safe_suffix = 'A' * 500
        payload = company_payload(
            self.industry,
            tax_code='0101234567',
            description=(
                '<p onclick="steal()">Công ty <strong>an toàn</strong>. '
                f'{safe_suffix}<script>alert(1)</script></p>'
            ),
        )
        response = self.client.post(reverse('employer-company-create'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        company = Company.objects.get(public_id=response.data['public_id'])
        self.assertEqual(company.tax_code, '0101234567')
        self.assertEqual(
            company.description,
            f'<p>Công ty <strong>an toàn</strong>. {safe_suffix}</p>',
        )

    def test_description_requires_at_least_500_visible_characters(self):
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, description=f'<p>{"A" * 499}</p>'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('description', response.data)
        self.assertIn('500', str(response.data['description']))

    # 7 lượt tạo của cùng một tài khoản vượt scope company_create (5/ngày, ADR-0031).
    @patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'company_create': '100/day'})
    def test_tax_code_accepts_only_10_or_13_digits(self):
        for invalid_tax_code in (
            '010123456A',
            '123456789',
            '12345678901234',
            '010 123 4567',
            '0101234567-001',
            '０１０１２３４５６７８９',
        ):
            with self.subTest(tax_code=invalid_tax_code):
                response = self.client.post(
                    reverse('employer-company-create'),
                    company_payload(self.industry, tax_code=invalid_tax_code),
                    format='json',
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
                self.assertIn('tax_code', response.data)

        accepted = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, tax_code='0101234567001'),
            format='json',
        )
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED, accepted.data)
        self.assertEqual(
            Company.objects.get(public_id=accepted.data['public_id']).tax_code,
            '0101234567001',
        )

    def test_company_catalogs_are_server_driven(self):
        response = self.client.get(reverse('employer-company-catalogs'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            {'value': 'enterprise', 'label': 'Doanh nghiệp'}, response.data['business_types']
        )
        self.assertTrue(response.data['company_sizes'])
        self.assertTrue(response.data['markets'])
        self.assertTrue(response.data['target_customers'])

    def test_registration_placeholder_does_not_block_explicit_company_creation(self):
        placeholder = Company.objects.create(
            company_name='Tên khai báo ban đầu',
            has_no_logo=True,
            has_no_website=True,
            created_by=self.user,
        )
        self.recruiter.company = placeholder
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save()

        before = self.client.get(reverse('employer-me'))
        response = self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )

        self.assertFalse(before.data['onboarding']['company_linked'])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.recruiter.refresh_from_db()
        self.assertNotEqual(self.recruiter.company, placeholder)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class JoinCompanyTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.owner, _ = make_recruiter('owner@example.com')
        self.company = Company.objects.create(
            company_name='Acme Corp', tax_code='0101234567', created_by=self.owner
        )
        # Only a verified owner approves joins.
        make_verified_representative(self.owner, company=self.company)
        self.user, self.recruiter = make_recruiter('hr2@example.com')
        authenticate_employer(self.client, self.user)

    def _join(self):
        return self.client.post(
            reverse('employer-company-join'),
            {
                'company': self.company.public_id,
            },
            format='multipart',
        )

    def _approved_join(self):
        response = self._join()
        decide_company_join(self.owner, response.data['public_id'], approve=True)
        return response

    def test_search_finds_company_by_name_and_tax_code(self):
        for q in ['Acme', '0101234567']:
            response = self.client.get(reverse('employer-company-search'), {'q': q})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['results'][0]['public_id'], self.company.public_id)
            self.assertNotIn('verification_status', response.data['results'][0])

    def test_search_returns_every_catalog_company_without_recruiter_status_gating(self):
        approved_user, approved_recruiter = make_recruiter('approved-catalog@example.com')
        approved_company = Company.objects.create(
            company_name='Catalog có NTD đã duyệt',
            tax_code='0201234567',
            created_by=approved_user,
        )
        approved_recruiter.company = approved_company
        approved_recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        approved_recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
        EmployerVerificationCase.objects.create(
            recruiter=approved_recruiter,
            company=approved_company,
            status=EmployerVerificationCase.Status.APPROVED,
            submitted_at=timezone.now(),
            decided_at=timezone.now(),
        )
        unreviewed_user, _ = make_recruiter('unreviewed-catalog@example.com')
        unreviewed_company = Company.objects.create(
            company_name='Catalog chưa có hồ sơ NTD',
            tax_code='0301234567',
            created_by=unreviewed_user,
        )

        response = self.client.get(reverse('employer-company-search'), {'q': 'Catalog'})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertSetEqual(
            {item['public_id'] for item in response.data['results']},
            {approved_company.public_id, unreviewed_company.public_id},
        )
        for item in response.data['results']:
            self.assertNotIn('verification_status', item)

    def test_blank_search_returns_six_recent_real_companies_and_excludes_placeholder(self):
        for index in range(7):
            Company.objects.create(
                company_name=f'Công ty mới {index}',
                tax_code=f'02000000{index:02d}',
                created_by=self.user,
            )
        Company.objects.create(
            company_name='Placeholder cũ',
            has_no_logo=True,
            has_no_website=True,
            created_by=self.user,
        )

        response = self.client.get(reverse('employer-company-search'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 6)
        names = [item['company_name'] for item in response.data['results']]
        self.assertNotIn('Placeholder cũ', names)
        self.assertEqual(names[0], 'Công ty mới 6')

    def test_join_waits_for_the_owner_then_links_as_member(self):
        response = self._join()
        mine = self.client.get(reverse('employer-company-join-mine'))
        self.recruiter.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED, response.data)
        self.assertEqual(response.data['status'], CompanyJoinRequest.Status.PENDING)
        self.assertEqual(mine.data['public_id'], response.data['public_id'])
        self.assertIsNone(self.recruiter.company)
        self.assertTrue(
            EmployerNotification.objects.filter(
                recipient=self.owner,
                event_type=EmployerNotification.EventType.COMPANY_JOIN_REQUESTED,
            ).exists()
        )

        authenticate_employer(self.client, self.owner)
        queue = self.client.get(reverse('employer-company-join-requests'))
        approved = self.client.post(
            reverse(
                'employer-company-join-decision',
                kwargs={'public_id': response.data['public_id'], 'decision': 'approve'},
            )
        )

        self.assertEqual([item['public_id'] for item in queue.data], [response.data['public_id']])
        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)
        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.company, self.company)
        self.assertEqual(self.recruiter.company_role, RecruiterProfile.CompanyRole.MEMBER)

    def test_only_the_owner_decides_and_a_rejection_links_nothing(self):
        response = self._join()
        member, member_recruiter = make_recruiter('member@example.com')
        member_recruiter.company = self.company
        member_recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_recruiter.save(update_fields=['company', 'company_role', 'updated_at'])

        authenticate_employer(self.client, member)
        by_member = self.client.post(
            reverse(
                'employer-company-join-decision',
                kwargs={'public_id': response.data['public_id'], 'decision': 'approve'},
            )
        )
        authenticate_employer(self.client, self.owner)
        rejected = self.client.post(
            reverse(
                'employer-company-join-decision',
                kwargs={'public_id': response.data['public_id'], 'decision': 'reject'},
            )
        )

        self.assertEqual(by_member.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(rejected.data['status'], CompanyJoinRequest.Status.REJECTED)
        self.recruiter.refresh_from_db()
        self.assertIsNone(self.recruiter.company)

    def test_a_pending_request_can_be_cancelled_to_pick_another_company(self):
        self._join()
        other = Company.objects.create(
            company_name='Công ty khác', tax_code='0207654320', created_by=self.owner
        )
        elsewhere = self.client.post(
            reverse('employer-company-join'), {'company': other.public_id}, format='multipart'
        )
        cancelled = self.client.delete(reverse('employer-company-join-mine'))
        retried = self.client.post(
            reverse('employer-company-join'), {'company': other.public_id}, format='multipart'
        )

        self.assertEqual(elsewhere.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(cancelled.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(retried.status_code, status.HTTP_202_ACCEPTED, retried.data)

    def test_joining_company_does_not_inherit_other_recruiter_documents(self):
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.create(
                company=self.company,
                uploaded_by=self.company.created_by,
                doc_type=doc_type,
                file_url=f'employers/owner/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                status=CompanyDocument.Status.APPROVED,
            )

        join_response = self._approved_join()
        profile_response = self.client.get(reverse('employer-me'))
        documents_response = self.client.get(reverse('employer-company-documents'))

        self.assertEqual(join_response.status_code, status.HTTP_202_ACCEPTED, join_response.data)
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK, profile_response.data)
        onboarding = profile_response.data['onboarding']
        self.assertTrue(onboarding['company_linked'])
        self.assertFalse(onboarding['business_doc_submitted'])
        self.assertFalse(onboarding['candidate_dpa_submitted'])
        self.assertFalse(onboarding['dpa_accepted'])
        self.assertFalse(onboarding['verification_completed'])
        self.assertEqual(documents_response.status_code, status.HTTP_200_OK)
        self.assertEqual(documents_response.data, [])

    def test_join_does_not_require_verified_phone(self):
        self.recruiter.verified_phone = ''
        self.recruiter.phone_verified_at = None
        self.recruiter.save(update_fields=['verified_phone', 'phone_verified_at', 'updated_at'])

        response = self._join()

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED, response.data)

    def test_join_rejects_legacy_membership_proof(self):
        response = self.client.post(
            reverse('employer-company-join'),
            {
                'company': self.company.public_id,
                'proof_type': 'business_registration',
                'business_registration_file': SimpleUploadedFile(
                    'gdkd.png', PNG_BYTES, content_type='image/png'
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không yêu cầu', str(response.data))

    def test_cannot_select_or_create_another_company_after_joining(self):
        first = self._approved_join()
        other_company = Company.objects.create(
            company_name='Công ty khác', tax_code='0207654321', created_by=self.user
        )
        second = self.client.post(
            reverse('employer-company-join'),
            {
                'company': other_company.public_id,
            },
            format='multipart',
        )
        industry = Industry.objects.get(name='Bảo hiểm')
        create = self.client.post(
            reverse('employer-company-create'),
            company_payload(industry, tax_code='0307654321'),
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED, first.data)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('đổi công ty khác', str(second.data))
        self.assertEqual(create.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không thể tạo hoặc đổi công ty khác', str(create.data))

    def test_candidate_dpa_can_be_saved(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                first = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                        'file': SimpleUploadedFile(
                            'thoa-thuan-cu.docx',
                            DOCX_BYTES,
                            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        ),
                    },
                    format='multipart',
                )
                replacement = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                        'file': SimpleUploadedFile(
                            'thoa-thuan-moi.docx',
                            DOCX_BYTES,
                            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED, replacement.data)
        documents = CompanyDocument.objects.filter(
            recruiter=self.recruiter,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        )
        self.assertEqual(documents.count(), 2)
        previous = documents.get(pk=first.data['id'])
        document = documents.get(pk=replacement.data['id'])
        self.assertIsNone(document.company)
        self.assertEqual(document.file_name, 'Thỏa thuận xử lý DLCN')
        self.assertFalse(previous.is_current)
        self.assertTrue(document.is_current)
        self.assertEqual(document.version, 2)
        self.assertEqual(document.supersedes, previous)
        self.assertTrue(
            self.client.get(reverse('employer-me')).data['onboarding']['candidate_dpa_submitted']
        )
        listed = self.client.get(reverse('employer-company-documents'))
        self.assertEqual(listed.status_code, status.HTTP_200_OK, listed.data)
        self.assertEqual(len(listed.data), 2)
        self.assertEqual(listed.data[0]['id'], document.id)

    def test_current_recruiter_dpa_is_listed_before_legacy_company_dpa(self):
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
        CompanyDocument.objects.create(
            company=self.company,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url='employers/legacy-company-dpa.pdf',
            file_name='Thỏa thuận xử lý DLCN',
        )
        current_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url='employers/current-recruiter-dpa.docx',
            file_name='Thỏa thuận xử lý DLCN',
        )

        response = self.client.get(reverse('employer-company-documents'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data[0]['id'], current_document.id)
        self.assertEqual(
            response.data[0]['file_url'],
            f'http://testserver{reverse("employer-company-document-content", kwargs={"pk": current_document.pk})}',
        )

    def test_join_with_password_session(self):
        response = self._join()

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED, response.data)

    def test_trade_name_proof_can_be_saved_as_website(self):
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save(update_fields=['company', 'company_role', 'updated_at'])

        response = self.client.post(
            reverse('employer-company-documents'),
            {
                'doc_type': CompanyDocument.DocType.TRADE_NAME_PROOF,
                'source_type': 'website',
                'website_url': 'https://example.com/thuong-hieu',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['source_type'], 'website')
        self.assertEqual(response.data['file_url'], 'https://example.com/thuong-hieu')
        document = CompanyDocument.objects.get(doc_type=CompanyDocument.DocType.TRADE_NAME_PROOF)
        self.assertEqual(document.file_name, 'Website chứng minh tên thương mại')

    def test_private_company_document_is_served_only_to_an_authorised_employer(self):
        self._join()
        stored_name = private_media_storage().save(
            'employers/documents/company-registration.png', ContentFile(PNG_BYTES)
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url=stored_name,
            file_name='company-registration.png',
        )

        with patch(
            'apps.employers.api.views.company_documents.render_office_document_preview',
            return_value=None,
        ):
            response = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b''.join(response.streaming_content), PNG_BYTES)
        self.assertEqual(response['Cache-Control'], 'private, no-store')

        outsider, _ = make_recruiter('outside-documents@example.com')
        authenticate_employer(self.client, outsider)
        denied = self.client.get(
            reverse('employer-company-document-content', kwargs={'pk': document.pk})
        )
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_private_dpa_keeps_its_docx_type_and_extension(self):
        self._join()
        stored_name = private_media_storage().save(
            'employers/documents/candidate-dpa.docx',
            ContentFile(DOCX_BYTES),
        )
        document = CompanyDocument.objects.create(
            recruiter=self.recruiter,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url=stored_name,
            file_name='Thỏa thuận xử lý DLCN',
            mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        with patch(
            'apps.employers.api.views.company_documents.render_office_document_preview',
            return_value=None,
        ):
            response = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        self.assertIn('.docx', response['Content-Disposition'])

        with patch(
            'apps.employers.api.views.company_documents.render_office_document_preview',
            return_value=b'%PDF-private-preview',
        ):
            preview = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(preview['Content-Type'], 'application/pdf')
        self.assertEqual(b''.join(preview.streaming_content), b'%PDF-private-preview')

    @patch('common.files.office_preview.subprocess.run')
    def test_raw_word_agreement_preview_requires_scan_without_running_office(self, soffice_run):
        upload = SimpleUploadedFile(
            'thoa-thuan.docx',
            DOCX_BYTES,
            content_type='application/octet-stream',
        )

        response = self.client.post(
            reverse('employer-company-document-upload-preview'),
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'UPLOAD_SCAN_REQUIRED')
        self.assertIn('quét an toàn', response.data['message'])
        soffice_run.assert_not_called()
        self.assertFalse(CompanyDocument.objects.filter(recruiter=self.recruiter).exists())
