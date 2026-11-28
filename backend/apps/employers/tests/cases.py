"""Shared TestCase bases and fixtures for employer tests split across feature modules."""

import json
import re

from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.tests.factories import make_admin
from apps.campaigns.models import RecruitmentCampaign
from apps.employers.domain.page_registry import MAIN_SECTION_KEYS
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

from ..models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyPageEditorGrant,
    CompanyTaxLookupEvidence,
    EmployerComplianceHold,
    EmployerDpaAcceptance,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
from ..services import (
    confirm_verification_decision,
    confirm_verification_lifecycle_action,
    get_or_create_verification_case,
    record_verification_upload,
    start_company_update_review,
    verification_decision_impact,
    verification_lifecycle_impact,
)
from .factories import (
    add_recruiter,
    make_company,
    make_employer,
    make_employer_ready,
)


class VerificationStateMachineTestCase(APITestCase):
    """A recruiter with an in-review case, a public job and a regular/super admin pair."""

    def setUp(self):
        self.superadmin = User.objects.create_superuser(
            email='er5-superadmin@example.com',
            password='Password@123',
        )
        self.reviewer = make_admin('er5-reviewer@example.com')

        self.employer = User.objects.create_user(
            email='er5-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='ER-5 Company',
            tax_code='0312345678',
            created_by=self.employer,
        )
        self.recruiter = make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        self.case = self.recruiter.verification_case
        self.case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.case.review_started_at = timezone.now()
        self.case.reviewer = self.reviewer
        self.case.lock_version = 1
        self.case.save(
            update_fields=[
                'status',
                'review_started_at',
                'reviewer',
                'lock_version',
                'updated_at',
            ]
        )
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND)
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='ER-5 Campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 Backend Engineer',
            description='State machine regression job.',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
            approved_at=timezone.now(),
            **open_visibility_window(),
        )

    def _replace_tax_evidence(self, evidence_status, *, mismatch=False):
        self.case.tax_lookup_evidences.all().delete()
        return CompanyTaxLookupEvidence.objects.create(
            company=self.company,
            verification_case=self.case,
            requested_by=self.employer,
            workflow_revision=self.case.revision,
            tax_code=self.company.tax_code,
            submitted_company_name=self.company.company_name,
            status=evidence_status,
            returned_tax_code=('0399999999' if mismatch else self.company.tax_code),
            registered_name=('Công ty không khớp' if mismatch else self.company.company_name),
            response_hash='a' * 64,
            completed_at=(
                None
                if evidence_status == CompanyTaxLookupEvidence.Status.PENDING
                else timezone.now()
            ),
        )

    def _company_snapshot(self):
        return Company.objects.filter(pk=self.company.pk).values().get()

    def _approve(self, *, actor=None, tax_override=False, tax_override_reason=''):
        actor = actor or self.superadmin
        company_snapshot = self._company_snapshot()
        self.case.refresh_from_db()
        impact = verification_decision_impact(
            self.case,
            actor=actor,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
        )
        self.assertNotIn('company_impact', impact)
        self.case = confirm_verification_decision(
            self.case,
            actor=actor,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            impact_token=impact['impact_token'],
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
        )
        self.assertNotIn('company_impact', self.case.decision_snapshot)
        self.assertEqual(self._company_snapshot(), company_snapshot)
        return impact

    def _revoke(self, *, action=EmployerVerificationCase.Status.REVOKED):
        company_snapshot = self._company_snapshot()
        self.case.refresh_from_db()
        impact = verification_lifecycle_impact(
            self.case,
            actor=self.reviewer,
            action=action,
            reason='Bằng chứng đại diện không còn hiệu lực.',
        )
        self.assertNotIn('company_impact', impact)
        self.case = confirm_verification_lifecycle_action(
            self.case,
            actor=self.reviewer,
            action=action,
            reason='Bằng chứng đại diện không còn hiệu lực.',
            impact_token=impact['impact_token'],
        )
        self.assertNotIn('company_impact', self.case.decision_snapshot)
        self.assertEqual(self._company_snapshot(), company_snapshot)
        return impact

    def _decide_nonapproval(self, decision):
        self.case.refresh_from_db()
        impact = verification_decision_impact(
            self.case,
            actor=self.reviewer,
            decision=decision,
            reason='Cần bổ sung bằng chứng đại diện.',
        )
        self.assertNotIn('company_impact', impact)
        self.case = confirm_verification_decision(
            self.case,
            actor=self.reviewer,
            decision=decision,
            reason='Cần bổ sung bằng chứng đại diện.',
            impact_token=impact['impact_token'],
        )
        self.assertNotIn('company_impact', self.case.decision_snapshot)

    def _replace_business_document_and_resubmit(self):
        current = self.case.documents.get(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            is_current=True,
        )
        current.is_current = False
        current.save(update_fields=['is_current', 'updated_at'])
        replacement = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.employer,
            verification_case=self.case,
            supersedes=current,
            version=current.version + 1,
            doc_type=current.doc_type,
            file_url='employers/er5/resubmitted.pdf',
            sha256='d' * 64,
            status=CompanyDocument.Status.PENDING,
        )
        self.case = record_verification_upload(
            recruiter=self.recruiter,
            document=replacement,
            verification_method=(EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION),
        )
        return replacement


class AdminVerificationTestCase(APITestCase):
    """Two recruiters of one company, a regular admin and the review helpers."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='verification-admin@example.com',
            password='Password@123',
        )
        self.first_user = self._employer('first-recruiter@example.com')
        self.company = Company.objects.create(
            company_name='Công ty dùng chung',
            tax_code='0109999999',
            created_by=self.first_user,
        )
        self.first = self._complete_recruiter(self.first_user)
        self.second_user = self._employer('second-recruiter@example.com')
        self.second = self._complete_recruiter(self.second_user)
        self.first_case = self._case_with_approved_documents(self.first)
        self.second_case = self._case_with_approved_documents(self.second)

    def _employer(self, email):
        return User.objects.create_user(
            email=email,
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )

    def _complete_recruiter(self, user):
        # The verified number is also the contact and login number.
        User.objects.filter(pk=user.pk).update(phone=f'09{user.pk:08d}')
        user.phone = f'09{user.pk:08d}'
        recruiter = RecruiterProfile.objects.create(
            user=user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
            verified_phone=f'09{user.pk:08d}',
            contact_phone=f'09{user.pk:08d}',
            phone_verified_at=timezone.now(),
            registration_completed_at=timezone.now(),
            dpa_accepted_at=timezone.now(),
            dpa_policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
            dpa_document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
        )
        EmployerDpaAcceptance.objects.create(
            recruiter=recruiter,
            policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
            document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
            document_url=settings.EMPLOYER_DPA_DOCUMENT_URL,
        )
        return recruiter

    def _case_with_approved_documents(self, recruiter):
        case = get_or_create_verification_case(recruiter)
        case.verification_method = EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
        case.status = EmployerVerificationCase.Status.PENDING
        case.submitted_at = timezone.now()
        case.lock_version = 1
        case.save()
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.create(
                company=self.company,
                recruiter=recruiter,
                uploaded_by=recruiter.user,
                verification_case=case,
                doc_type=doc_type,
                file_url=f'employers/{recruiter.public_id}/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                mime_type='application/pdf',
                file_size=1024,
                sha256=f'{recruiter.pk:064x}',
                status=CompanyDocument.Status.APPROVED,
            )
        CompanyTaxLookupEvidence.objects.create(
            company=self.company,
            verification_case=case,
            requested_by=recruiter.user,
            workflow_revision=case.revision,
            tax_code=self.company.tax_code,
            submitted_company_name=self.company.company_name,
            status=CompanyTaxLookupEvidence.Status.FOUND,
            returned_tax_code=self.company.tax_code,
            registered_name=self.company.company_name,
            completed_at=timezone.now(),
        )
        return case

    def _put_in_review(self, case):
        case.status = EmployerVerificationCase.Status.IN_REVIEW
        case.reviewer = self.admin
        case.review_started_at = timezone.now()
        case.save(update_fields=['status', 'reviewer', 'review_started_at', 'updated_at'])
        return case

    def _put_company_update_in_review(self, update_request, *, actor=None):
        update_request.refresh_from_db()
        return start_company_update_review(
            update_request,
            actor=actor or self.admin,
            lock_version=update_request.lock_version,
            revision_public_id=(
                update_request.current_revision.public_id
                if update_request.current_revision_id
                else ''
            ),
        )


MEMBER = RecruiterProfile.CompanyRole.MEMBER
DEFAULT_ORDER = list(MAIN_SECTION_KEYS)
JOB_REFERENCE_KEYS = {'public_id', 'title', 'slug', 'published_at'}
PUBLIC_PROFILE_KEYS = {
    'public_id',
    'slug',
    'canonical_path',
    'indexable',
    'identity',
    'stats',
    'theme',
    'sections',
    'sidebar',
}
MEDIA_FORBIDDEN = 'người được cấp quyền biên tập'


class CompanyPageWorkspaceTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.creator = make_employer('workspace-creator@example.com')
        self.company = make_company(
            self.creator,
            name='Công ty TNHH Phần mềm Alpha',
            trade_name='Alpha Tech',
            industry=Industry.objects.create(name='Công nghệ thông tin'),
            address='17 Duy Tân, Cầu Giấy, Hà Nội',
            description='<p>Giới thiệu công ty.</p>',
            employee_benefits='<ul><li>Bảo hiểm sức khoẻ</li></ul>',
        )
        CompanyImage.objects.create(company=self.company, image_url='employers/alpha/office.png')
        self.owner = self._named(add_recruiter(self.company), 'An Chủ Sở Hữu')
        self.member = self._named(add_recruiter(self.company, role=MEMBER), 'Bình Thành Viên')
        self.page_url = reverse('employer-company-page')
        self.layout_url = reverse('employer-company-page-layout')
        self.pinnable_url = reverse('employer-company-page-pinnable-jobs')
        self.editors_url = reverse('employer-company-page-editors')
        self.client.force_authenticate(self.owner)

    def _named(self, user, full_name):
        user.full_name = full_name
        user.save(update_fields=['full_name'])
        return user

    def grant(self, user):
        return CompanyPageEditorGrant.objects.create(
            company=self.company,
            recruiter=user.recruiter_profile,
            granted_by=self.owner,
        )

    def editor_url(self, grant):
        return reverse('employer-company-page-editor-detail', args=[grant.public_id])

    def patch_layout(self, **body):
        body.setdefault('lock_version', 0)
        return self.client.patch(self.layout_url, body, format='json')

    def public_detail(self):
        return self.client.get(reverse('public-company-detail', args=[self.company.slug])).data

    def lapse_verification(self, user):
        EmployerVerificationCase.objects.filter(recruiter__user=user).update(
            status=EmployerVerificationCase.Status.EXPIRED
        )

    def hold(self, user):
        EmployerComplianceHold.objects.create(
            recruiter=user.recruiter_profile,
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_HOLD,
        )


LIST_ITEM_KEYS = {
    'public_id',
    'slug',
    'company_name',
    'trade_name',
    'logo_url',
    'cover_image_url',
    'description_excerpt',
    'headquarters',
    'active_public_job_count',
    'company_size',
    'company_size_display',
    'industries_detail',
}


SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)
JSON_LD_PATTERN = re.compile(
    r'<script data-seo-managed="server" type="application/ld\+json">(.*?)</script>',
    re.DOTALL,
)


def structured_data(html):
    """JSON-LD nodes of a rendered SEO shell, keyed by ``@type``."""
    payload = json.loads(JSON_LD_PATTERN.search(html).group(1))
    return {item['@type']: item for item in payload['@graph']}
