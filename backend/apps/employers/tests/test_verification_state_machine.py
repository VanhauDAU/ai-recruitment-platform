from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import StringIO
from threading import Event
from unittest.mock import patch

from django.core.management import call_command
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APITestCase

from apps.accounts.admin_access_cache import bust_admin_permission_cache
from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.services import StaleImpactToken, assign_membership
from apps.jobs.models import Job
from apps.jobs.selectors.listing import active_jobs_queryset
from apps.jobs.services import approve_job

from ..models import (
    Company,
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerComplianceHold,
    EmployerComplianceHoldJob,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    RecruitmentCampaign,
)
from ..services import (
    confirm_verification_decision,
    confirm_verification_lifecycle_action,
    get_or_create_verification_case,
    lock_verification_identity,
    record_verification_upload,
    recruiter_job_approval_state,
    recruiter_readiness_state,
    release_verification_holds,
    review_verification_document,
    start_verification_review,
    verification_decision_impact,
    verification_lifecycle_impact,
)
from .readiness_helpers import make_employer_ready


class EmployerVerificationStateMachineTests(APITestCase):
    def setUp(self):
        self.superadmin = User.objects.create_superuser(
            email='er5-superadmin@example.com',
            password='Password@123',
        )
        self.reviewer = User.objects.create_user(
            email='er5-reviewer@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        self.compliance_lead = User.objects.create_user(
            email='er5-compliance@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        self.unprivileged_admin = User.objects.create_user(
            email='er5-unprivileged@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        department = Department.objects.create(
            code='er5-compliance',
            name='ER-5 Compliance',
        )
        review_role = AdminRole.objects.create(
            department=department,
            code='reviewer',
            name='Reviewer',
        )
        compliance_role = AdminRole.objects.create(
            department=department,
            code='compliance-lead',
            name='Compliance Lead',
        )
        permissions = {
            code: AdminPermission.objects.get(code=code)
            for code in (
                'employer_verification.view',
                'employer_verification.review',
                'employer_verification.revoke',
                'employer_verification.tax_override',
            )
        }
        review_role.permissions.add(
            permissions['employer_verification.view'],
            permissions['employer_verification.review'],
        )
        compliance_role.permissions.add(*permissions.values())
        assign_membership(self.reviewer, review_role, actor=self.superadmin)
        assign_membership(self.compliance_lead, compliance_role, actor=self.superadmin)
        bust_admin_permission_cache([self.reviewer.pk, self.compliance_lead.pk])

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

    def _approve(self, *, actor=None, tax_override=False, tax_override_reason=''):
        actor = actor or self.superadmin
        self.case.refresh_from_db()
        impact = verification_decision_impact(
            self.case,
            actor=actor,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
        )
        self.case = confirm_verification_decision(
            self.case,
            actor=actor,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            impact_token=impact['impact_token'],
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
        )
        return impact

    def _revoke(self, *, action=EmployerVerificationCase.Status.REVOKED):
        self.case.refresh_from_db()
        impact = verification_lifecycle_impact(
            self.case,
            actor=self.compliance_lead,
            action=action,
            reason='Bằng chứng đại diện không còn hiệu lực.',
        )
        self.case = confirm_verification_lifecycle_action(
            self.case,
            actor=self.compliance_lead,
            action=action,
            reason='Bằng chứng đại diện không còn hiệu lực.',
            impact_token=impact['impact_token'],
        )
        return impact

    def _decide_nonapproval(self, decision):
        self.case.refresh_from_db()
        impact = verification_decision_impact(
            self.case,
            actor=self.reviewer,
            decision=decision,
            reason='Cần bổ sung bằng chứng đại diện.',
        )
        self.case = confirm_verification_decision(
            self.case,
            actor=self.reviewer,
            decision=decision,
            reason='Cần bổ sung bằng chứng đại diện.',
            impact_token=impact['impact_token'],
        )

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

    def test_document_decision_never_decides_case_or_company(self):
        document = self.case.documents.get(doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION)
        document.status = CompanyDocument.Status.PENDING
        document.save(update_fields=['status', 'updated_at'])

        _, case = review_verification_document(
            document,
            actor=self.reviewer,
            decision=CompanyDocument.Status.APPROVED,
            reason='',
            lock_version=self.case.lock_version,
        )

        self.company.refresh_from_db()
        self.assertEqual(case.status, EmployerVerificationCase.Status.IN_REVIEW)
        self.assertEqual(self.company.verification_status, Company.VerificationStatus.UNVERIFIED)
        self.assertFalse(
            case.events.filter(event_type=EmployerVerificationEvent.EventType.APPROVED).exists()
        )

    def test_review_services_enforce_permission_without_relying_on_api(self):
        document = self.case.documents.get(doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION)
        original_lock_version = self.case.lock_version

        with self.assertRaises(PermissionDenied):
            start_verification_review(self.case, actor=self.unprivileged_admin)
        with self.assertRaises(PermissionDenied):
            review_verification_document(
                document,
                actor=self.unprivileged_admin,
                decision=CompanyDocument.Status.APPROVED,
                reason='',
                lock_version=original_lock_version,
            )

        self.case.refresh_from_db()
        document.refresh_from_db()
        self.assertEqual(self.case.lock_version, original_lock_version)
        self.assertNotEqual(document.reviewed_by, self.unprivileged_admin)

    def test_company_relink_is_blocked_and_public_job_fails_closed(self):
        self._approve()
        self.assertEqual(self.client.get(reverse('job-list')).data['count'], 1)
        replacement_company = Company.objects.create(
            company_name='ER-5 replacement company',
            tax_code='0312345689',
            created_by=self.employer,
        )
        self.recruiter.company = replacement_company
        self.recruiter.save(update_fields=['company', 'updated_at'])

        with self.assertRaises(ValidationError) as blocked:
            get_or_create_verification_case(self.recruiter)

        self.assertEqual(
            str(blocked.exception.detail['code']),
            'VERIFICATION_COMPANY_RELINK_REQUIRES_REVIEW',
        )
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.case.company, self.company)
        self.assertEqual(self.client.get(reverse('job-list')).data['count'], 0)

    def test_legacy_active_job_without_verification_case_remains_public(self):
        legacy_employer = User.objects.create_user(
            email='er5-legacy-no-case@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        legacy_company = Company.objects.create(
            company_name='ER-5 legacy grandfather company',
            created_by=legacy_employer,
        )
        legacy_recruiter = self.recruiter.__class__.objects.create(
            user=legacy_employer,
            company=legacy_company,
            registration_completed_at=timezone.now(),
        )
        legacy_job = Job.objects.create(
            posted_by=legacy_employer,
            company=legacy_company,
            title='ER-5 grandfathered active job',
            description='Legacy job without a verification case.',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
        )

        response = self.client.get(reverse('job-list'))

        self.assertTrue(
            any(item['public_id'] == legacy_job.public_id for item in response.data['results'])
        )
        self.assertFalse(
            EmployerVerificationCase.objects.filter(recruiter=legacy_recruiter).exists()
        )

    def test_final_decision_requires_in_review_with_stable_error(self):
        self.case.status = EmployerVerificationCase.Status.PENDING
        self.case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.case.public_id},
            ),
            {'decision': EmployerVerificationCase.Status.APPROVED},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(str(response.data['code']), 'VERIFICATION_INVALID_TRANSITION')

    def test_changes_requested_resubmits_same_case_and_increments_revision(self):
        public_id = self.case.public_id
        self._decide_nonapproval(EmployerVerificationCase.Status.CHANGES_REQUESTED)

        self._replace_business_document_and_resubmit()

        self.assertEqual(self.case.public_id, public_id)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(self.case.revision, 2)
        self.assertTrue(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.RESUBMITTED,
                payload__revision=2,
            ).exists()
        )

    def test_rejected_resubmits_same_case_and_increments_revision(self):
        public_id = self.case.public_id
        self._decide_nonapproval(EmployerVerificationCase.Status.REJECTED)

        self._replace_business_document_and_resubmit()

        self.assertEqual(self.case.public_id, public_id)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(self.case.revision, 2)

        self._replace_business_document_and_resubmit()

        self.assertEqual(self.case.revision, 2)

    def test_multiple_terminal_document_replacements_bump_one_revision_only(self):
        current_documents = list(self.case.documents.filter(is_current=True))
        for document in current_documents:
            document.status = CompanyDocument.Status.REJECTED
            document.review_note = 'Cần thay cả hai tài liệu.'
            document.save(update_fields=['status', 'review_note', 'updated_at'])
        self.case.status = EmployerVerificationCase.Status.REJECTED
        self.case.decision_reason = 'Cần thay cả hai tài liệu.'
        self.case.save(update_fields=['status', 'decision_reason', 'updated_at'])

        for index, current in enumerate(current_documents, start=1):
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
                file_url=f'employers/er5/multi-resubmit-{index}.pdf',
                sha256=str(index) * 64,
                status=CompanyDocument.Status.PENDING,
            )
            self.case = record_verification_upload(
                recruiter=self.recruiter,
                document=replacement,
                verification_method=(
                    EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
                ),
            )
            self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
            self.assertEqual(self.case.revision, 2)

        self.assertEqual(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.RESUBMITTED
            ).count(),
            1,
        )

    def test_tax_pending_cannot_be_overridden(self):
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.PENDING)
        self.client.force_authenticate(self.compliance_lead)

        response = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.case.public_id},
            ),
            {
                'decision': EmployerVerificationCase.Status.APPROVED,
                'tax_override': True,
                'tax_override_reason': 'Đã đối chiếu thủ công.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(str(response.data['code']), 'TAX_LOOKUP_PENDING')

    def test_tax_override_is_denied_to_reviewer_and_audited_for_compliance_lead(self):
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND, mismatch=True)
        url = reverse(
            'admin-employer-verification-decision-impact',
            kwargs={'public_id': self.case.public_id},
        )
        payload = {
            'decision': EmployerVerificationCase.Status.APPROVED,
            'tax_override': True,
            'tax_override_reason': 'Đã đối chiếu giấy phép bản gốc.',
        }
        self.client.force_authenticate(self.reviewer)
        denied = self.client.post(url, payload, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

        self.client.force_authenticate(self.compliance_lead)
        impact = self.client.post(url, payload, format='json')
        self.assertEqual(impact.status_code, status.HTTP_200_OK, impact.data)
        confirmed = self.client.post(
            reverse(
                'admin-employer-verification-decision',
                kwargs={'public_id': self.case.public_id},
            ),
            {**payload, 'impact_token': impact.data['impact_token']},
            format='json',
        )

        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.case.tax_override_by, self.compliance_lead)
        self.assertEqual(
            self.case.tax_override_reason,
            'Đã đối chiếu giấy phép bản gốc.',
        )
        decision_event = self.case.events.filter(
            event_type=EmployerVerificationEvent.EventType.APPROVED
        ).latest('id')
        self.assertTrue(decision_event.payload['tax_override'])
        self.assertEqual(
            decision_event.payload['tax_override_reason'],
            'Đã đối chiếu giấy phép bản gốc.',
        )
        audit = AdminAccessAuditLog.objects.filter(
            action='decide_employer_verification',
            target_public_id=self.case.public_id,
        ).latest('id')
        self.assertEqual(audit.actor, self.compliance_lead)
        self.assertEqual(
            audit.payload['tax_override_reason'],
            'Đã đối chiếu giấy phép bản gốc.',
        )

    def test_superuser_bypasses_explicit_tax_override_grant(self):
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND, mismatch=True)

        self._approve(
            actor=self.superadmin,
            tax_override=True,
            tax_override_reason='Super Admin đối chiếu bản gốc.',
        )

        self.case.refresh_from_db()
        self.assertEqual(self.case.tax_override_by, self.superadmin)

    def test_reviewer_cannot_revoke_but_explicit_compliance_role_can_preview(self):
        self._approve(actor=self.reviewer)
        url = reverse(
            'admin-employer-verification-revoke-impact',
            kwargs={'public_id': self.case.public_id},
        )
        self.client.force_authenticate(self.reviewer)
        denied = self.client.post(url, {'reason': 'Rà soát lại.'}, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

        self.client.force_authenticate(self.compliance_lead)
        allowed = self.client.post(url, {'reason': 'Rà soát lại.'}, format='json')
        self.assertEqual(allowed.status_code, status.HTTP_200_OK, allowed.data)
        self.assertFalse(allowed.data['company_impact']['will_downgrade'])

    def test_revoke_hides_public_job_and_blocks_data_without_downgrading_company(self):
        self._approve()
        visible = self.client.get(reverse('job-list'))
        self.assertEqual(visible.data['count'], 1)

        impact = self._revoke()

        self.case.refresh_from_db()
        self.company.refresh_from_db()
        self.job.refresh_from_db()
        hold = EmployerComplianceHold.objects.get(
            recruiter=self.recruiter,
            source=EmployerComplianceHold.Source.VERIFICATION,
            status=EmployerComplianceHold.Status.ACTIVE,
        )
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.REVOKED)
        self.assertEqual(self.company.verification_status, Company.VerificationStatus.VERIFIED)
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertTrue(hold.job_links.filter(job=self.job).exists())
        self.assertEqual(impact['resources']['active_jobs_hidden_from_public'], 1)
        self.assertEqual(self.client.get(reverse('job-list')).data['count'], 0)
        _, readiness = recruiter_readiness_state(self.employer)
        self.assertTrue(readiness['job_workspace_ready'])
        self.assertFalse(readiness['candidate_data_access'])
        self.assertFalse(readiness['verification_approved'])

    def test_lifecycle_impact_counts_only_jobs_that_are_currently_public(self):
        self._approve()
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 expired job',
            description='Expired.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() - timedelta(days=1),
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 policy held job',
            description='Policy held.',
            status=Job.Status.ACTIVE,
            policy_hold=Job.PolicyHold.TEMPORARY_LOCK,
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 moderation held job',
            description='Moderation held.',
            status=Job.Status.ACTIVE,
            moderation_hold=Job.ModerationHold.MANUAL_REVIEW,
        )
        paused_campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='ER-5 paused campaign',
            status=RecruitmentCampaign.Status.PAUSED,
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=paused_campaign,
            title='ER-5 paused campaign job',
            description='Paused campaign.',
            status=Job.Status.ACTIVE,
        )
        other_held_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 DPA held job',
            description='Other source hold.',
            status=Job.Status.ACTIVE,
        )
        dpa_hold = EmployerComplianceHold.objects.create(
            recruiter=self.recruiter,
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_OUTDATED,
            applied_by=self.superadmin,
        )
        EmployerComplianceHoldJob.objects.create(hold=dpa_hold, job=other_held_job)

        impact = verification_lifecycle_impact(
            self.case,
            actor=self.compliance_lead,
            action=EmployerVerificationCase.Status.REVOKED,
            reason='Rà soát lại bằng chứng đại diện.',
        )

        self.assertEqual(impact['resources']['job_count'], 6)
        self.assertEqual(impact['resources']['active_jobs_hidden_from_public'], 1)

    def test_manual_expire_uses_expired_hold_and_keeps_company_verified(self):
        self._approve()
        self._revoke(action=EmployerVerificationCase.Status.EXPIRED)

        self.case.refresh_from_db()
        self.company.refresh_from_db()
        hold = EmployerComplianceHold.objects.get(recruiter=self.recruiter)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.EXPIRED)
        self.assertEqual(
            hold.reason,
            EmployerComplianceHold.Reason.VERIFICATION_EXPIRED,
        )
        self.assertEqual(self.company.verification_status, Company.VerificationStatus.VERIFIED)

    def test_verification_hold_release_requires_nonblank_audit_reason(self):
        self._approve()
        self._revoke()
        scope = lock_verification_identity(self.case, include_resources=True)

        with self.assertRaises(ValidationError) as error:
            release_verification_holds(
                scope,
                actor=self.superadmin,
                reason='   ',
            )

        self.assertEqual(
            str(error.exception.detail['code']),
            'COMPLIANCE_HOLD_RELEASE_REASON_REQUIRED',
        )
        self.assertTrue(
            EmployerComplianceHold.objects.filter(
                recruiter=self.recruiter,
                source=EmployerComplianceHold.Source.VERIFICATION,
                status=EmployerComplianceHold.Status.ACTIVE,
            ).exists()
        )

    def test_reapproval_releases_only_verification_source_and_reports_unhide_impact(self):
        self._approve()
        self._revoke()
        old_document = self.case.documents.get(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            is_current=True,
        )
        old_document.is_current = False
        old_document.save(update_fields=['is_current', 'updated_at'])
        replacement = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.employer,
            verification_case=self.case,
            supersedes=old_document,
            version=old_document.version + 1,
            doc_type=old_document.doc_type,
            file_url='employers/er5/replacement.pdf',
            file_name='replacement.pdf',
            mime_type='application/pdf',
            file_size=100,
            sha256='b' * 64,
            status=CompanyDocument.Status.PENDING,
        )
        self.case = record_verification_upload(
            recruiter=self.recruiter,
            document=replacement,
            verification_method=(EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION),
        )
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(self.case.revision, 2)
        self.case = start_verification_review(self.case, actor=self.reviewer)
        _, self.case = review_verification_document(
            replacement,
            actor=self.reviewer,
            decision=CompanyDocument.Status.APPROVED,
            reason='',
            lock_version=self.case.lock_version,
        )
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND)
        verification_only_preview = verification_decision_impact(
            self.case,
            actor=self.reviewer,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        self.assertEqual(
            verification_only_preview['verification_hold_impact']['active_jobs_to_unhide'],
            1,
        )
        dpa_hold = EmployerComplianceHold.objects.create(
            recruiter=self.recruiter,
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_OUTDATED,
            applied_by=self.superadmin,
        )
        EmployerComplianceHoldJob.objects.create(hold=dpa_hold, job=self.job)

        preview = verification_decision_impact(
            self.case,
            actor=self.reviewer,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        self.assertEqual(preview['verification_hold_impact']['hold_count'], 1)
        self.assertEqual(preview['verification_hold_impact']['active_jobs_to_unhide'], 0)
        self.case = confirm_verification_decision(
            self.case,
            actor=self.reviewer,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            impact_token=preview['impact_token'],
        )

        self.assertFalse(
            EmployerComplianceHold.objects.filter(
                recruiter=self.recruiter,
                source=EmployerComplianceHold.Source.VERIFICATION,
                status=EmployerComplianceHold.Status.ACTIVE,
            ).exists()
        )
        dpa_hold.refresh_from_db()
        self.assertEqual(dpa_hold.status, EmployerComplianceHold.Status.ACTIVE)
        self.assertEqual(self.client.get(reverse('job-list')).data['count'], 0)
        _, readiness = recruiter_readiness_state(self.employer)
        self.assertFalse(readiness['candidate_data_access'])
        self.assertTrue(readiness['compliance_hold_active'])
        job_approval = recruiter_job_approval_state(
            self.employer,
            company_id=self.company.pk,
        )
        self.assertEqual(
            [blocker['code'] for blocker in job_approval['approve_blockers']],
            ['compliance_hold_active'],
        )
        self.assertTrue(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.REAPPROVED
            ).exists()
        )

        self._revoke(action=EmployerVerificationCase.Status.EXPIRED)
        self.assertEqual(
            EmployerComplianceHold.objects.filter(
                recruiter=self.recruiter,
                source=EmployerComplianceHold.Source.VERIFICATION,
                status=EmployerComplianceHold.Status.ACTIVE,
            ).count(),
            1,
        )
        self.assertTrue(
            EmployerComplianceHold.objects.filter(
                recruiter=self.recruiter,
                source=EmployerComplianceHold.Source.VERIFICATION,
                status=EmployerComplianceHold.Status.RELEASED,
                reason=EmployerComplianceHold.Reason.VERIFICATION_REVOKED,
            ).exists()
        )

    def test_same_count_job_replacement_stales_lifecycle_snapshot(self):
        self._approve()
        self.client.force_authenticate(self.compliance_lead)
        impact_url = reverse(
            'admin-employer-verification-revoke-impact',
            kwargs={'public_id': self.case.public_id},
        )
        payload = {'reason': 'Kiểm tra snapshot tài nguyên.'}
        impact = self.client.post(impact_url, payload, format='json')
        self.assertEqual(impact.status_code, status.HTTP_200_OK, impact.data)
        self.job.delete()
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 replacement with same count',
            description='Replacement.',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
        )

        confirmed = self.client.post(
            reverse(
                'admin-employer-verification-revoke',
                kwargs={'public_id': self.case.public_id},
            ),
            {**payload, 'impact_token': impact.data['impact_token']},
            format='json',
        )

        self.assertEqual(confirmed.status_code, status.HTTP_409_CONFLICT, confirmed.data)

    def test_company_change_stales_final_decision_snapshot(self):
        self._approve()
        self._revoke()
        self.case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.case.save(update_fields=['status', 'updated_at'])
        self.case.refresh_from_db()
        preview = verification_decision_impact(
            self.case,
            actor=self.superadmin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        self.company.company_name = 'ER-5 Company renamed after preview'
        self.company.save(update_fields=['company_name', 'updated_at'])

        with self.assertRaises(StaleImpactToken):
            confirm_verification_decision(
                self.case,
                actor=self.superadmin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
                impact_token=preview['impact_token'],
            )
        with self.assertRaises(ValidationError) as stale_evidence:
            verification_decision_impact(
                self.case,
                actor=self.superadmin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
            )
        self.assertEqual(str(stale_evidence.exception.detail['code']), 'TAX_OVERRIDE_REQUIRED')
        overridden = verification_decision_impact(
            self.case,
            actor=self.superadmin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            tax_override=True,
            tax_override_reason='Đã đối chiếu lại tên công ty hiện tại.',
        )
        self.assertEqual(overridden['tax_advisory']['status'], 'invalid')
        self.assertEqual(
            overridden['tax_advisory']['comparison']['company_name'],
            'stale_input',
        )

    def test_document_same_count_replacement_stales_final_decision_snapshot(self):
        preview = verification_decision_impact(
            self.case,
            actor=self.superadmin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        current = self.case.documents.get(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            is_current=True,
        )
        current.is_current = False
        current.save(update_fields=['is_current', 'updated_at'])
        CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.employer,
            verification_case=self.case,
            supersedes=current,
            version=current.version + 1,
            doc_type=current.doc_type,
            file_url='employers/er5/same-count-document.pdf',
            sha256='c' * 64,
            status=CompanyDocument.Status.APPROVED,
        )

        with self.assertRaises(StaleImpactToken):
            confirm_verification_decision(
                self.case,
                actor=self.superadmin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
                impact_token=preview['impact_token'],
            )

    def test_tax_evidence_same_status_replacement_stales_final_decision_snapshot(self):
        preview = verification_decision_impact(
            self.case,
            actor=self.superadmin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND)

        with self.assertRaises(StaleImpactToken):
            confirm_verification_decision(
                self.case,
                actor=self.superadmin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
                impact_token=preview['impact_token'],
            )

    def test_prerequisite_change_stales_final_decision_snapshot(self):
        preview = verification_decision_impact(
            self.case,
            actor=self.superadmin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        self.recruiter.phone_verified_at = timezone.now()
        self.recruiter.save(update_fields=['phone_verified_at', 'updated_at'])

        with self.assertRaises(StaleImpactToken):
            confirm_verification_decision(
                self.case,
                actor=self.superadmin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
                impact_token=preview['impact_token'],
            )

    def test_same_count_hold_link_replacement_stales_final_decision_snapshot(self):
        second_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 second linked job',
            description='Second resource for link replacement.',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
        )
        self._approve()
        self._revoke()
        self.case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.case.save(update_fields=['status', 'updated_at'])
        dpa_hold = EmployerComplianceHold.objects.create(
            recruiter=self.recruiter,
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_OUTDATED,
            applied_by=self.superadmin,
        )
        old_link = EmployerComplianceHoldJob.objects.create(
            hold=dpa_hold,
            job=self.job,
        )
        preview = verification_decision_impact(
            self.case,
            actor=self.superadmin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        old_link.delete()
        EmployerComplianceHoldJob.objects.create(hold=dpa_hold, job=second_job)

        with self.assertRaises(StaleImpactToken):
            confirm_verification_decision(
                self.case,
                actor=self.superadmin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
                impact_token=preview['impact_token'],
            )

    def test_legacy_classification_is_dry_run_idempotent_and_creates_no_evidence(self):
        self.case.status = EmployerVerificationCase.Status.APPROVED
        self.case.decision_source = ''
        self.case.save(update_fields=['status', 'decision_source', 'updated_at'])
        self.company.verification_status = Company.VerificationStatus.VERIFIED
        self.company.verification_source = ''
        self.company.save(
            update_fields=['verification_status', 'verification_source', 'updated_at']
        )
        EmployerVerificationEvent.objects.create(
            verification_case=self.case,
            actor=self.reviewer,
            event_type=EmployerVerificationEvent.EventType.APPROVED,
            payload={'source': 'document_review'},
        )
        evidence_count = CompanyTaxLookupEvidence.objects.count()
        dry_run = StringIO()
        call_command('classify_legacy_employer_verifications', stdout=dry_run)
        self.case.refresh_from_db()
        self.assertEqual(self.case.decision_source, '')

        applied = StringIO()
        call_command(
            'classify_legacy_employer_verifications',
            '--apply',
            stdout=applied,
        )
        self.case.refresh_from_db()
        self.company.refresh_from_db()
        self.assertEqual(
            self.case.decision_source,
            EmployerVerificationCase.DecisionSource.LEGACY_AUTO,
        )
        self.assertEqual(
            self.company.verification_source,
            Company.VerificationSource.LEGACY_AUTO,
        )
        rerun = StringIO()
        call_command('classify_legacy_employer_verifications', '--apply', stdout=rerun)
        self.assertIn('"cases": {}', rerun.getvalue())
        self.assertEqual(EmployerComplianceHold.objects.count(), 0)
        self.assertEqual(CompanyTaxLookupEvidence.objects.count(), evidence_count)

    def test_legacy_apply_does_not_overwrite_source_changed_during_classification(self):
        self.case.status = EmployerVerificationCase.Status.APPROVED
        self.case.decision_source = ''
        self.case.save(update_fields=['status', 'decision_source', 'updated_at'])
        self.company.verification_status = Company.VerificationStatus.VERIFIED
        self.company.verification_source = ''
        self.company.save(
            update_fields=['verification_status', 'verification_source', 'updated_at']
        )

        def concurrent_explicit_decision(case):
            EmployerVerificationCase.objects.filter(pk=case.pk).update(
                decision_source=EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN
            )
            return EmployerVerificationCase.DecisionSource.LEGACY_AUTO

        with patch(
            'apps.employers.management.commands.classify_legacy_employer_verifications.classify_case',
            side_effect=concurrent_explicit_decision,
        ):
            call_command('classify_legacy_employer_verifications', '--apply', stdout=StringIO())

        self.case.refresh_from_db()
        self.company.refresh_from_db()
        self.assertEqual(
            self.case.decision_source,
            EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN,
        )
        self.assertEqual(
            self.company.verification_source,
            Company.VerificationSource.EXPLICIT_ADMIN,
        )


class EmployerVerificationJobApprovalConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='er5-concurrency-admin@example.com',
            password='Password@123',
        )
        self.employer = User.objects.create_user(
            email='er5-concurrency-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='ER-5 Concurrency Company',
            tax_code='0312345699',
            created_by=self.employer,
        )
        self.recruiter = make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        self.case = self.recruiter.verification_case
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='ER-5 concurrency campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 concurrent approval job',
            description='Exercise the canonical U-R-Case-Company-Campaign-Job locks.',
            status=Job.Status.PENDING,
            submitted_at=timezone.now(),
        )

    def _impact(self):
        self.case.refresh_from_db()
        return verification_lifecycle_impact(
            self.case,
            actor=self.admin,
            action=EmployerVerificationCase.Status.REVOKED,
            reason='Concurrency regression revoke.',
        )

    def _approve_in_thread(self):
        close_old_connections()
        try:
            try:
                approve_job(
                    job=Job.objects.get(pk=self.job.pk),
                    user=self.admin,
                )
            except ValidationError as error:
                return error.detail
            return 'approved'
        finally:
            close_old_connections()

    def test_revoke_commits_first_and_concurrent_job_approval_fails_closed(self):
        impact = self._impact()
        revoke_locked = Event()
        allow_revoke = Event()
        approval_attempted = Event()
        from apps.employers.services.verification import (
            apply_verification_hold as real_apply_verification_hold,
        )

        def pause_revoke(scope, *, reason, actor):
            revoke_locked.set()
            if not allow_revoke.wait(timeout=10):
                raise AssertionError('Timed out before committing verification revoke.')
            return real_apply_verification_hold(scope, reason=reason, actor=actor)

        real_approval_state = recruiter_job_approval_state

        def signal_approval_attempt(*args, **kwargs):
            approval_attempted.set()
            return real_approval_state(*args, **kwargs)

        def revoke_in_thread():
            close_old_connections()
            try:
                return confirm_verification_lifecycle_action(
                    EmployerVerificationCase.objects.get(pk=self.case.pk),
                    actor=User.objects.get(pk=self.admin.pk),
                    action=EmployerVerificationCase.Status.REVOKED,
                    reason='Concurrency regression revoke.',
                    impact_token=impact['impact_token'],
                ).status
            finally:
                close_old_connections()

        with (
            patch(
                'apps.employers.services.verification.apply_verification_hold',
                side_effect=pause_revoke,
            ),
            patch(
                'apps.jobs.services.moderation.recruiter_job_approval_state',
                side_effect=signal_approval_attempt,
            ),
            ThreadPoolExecutor(max_workers=2) as pool,
        ):
            revoke = pool.submit(revoke_in_thread)
            self.assertTrue(revoke_locked.wait(timeout=10))
            approval = pool.submit(self._approve_in_thread)
            self.assertTrue(approval_attempted.wait(timeout=10))
            allow_revoke.set()
            self.assertEqual(revoke.result(timeout=10), EmployerVerificationCase.Status.REVOKED)
            approval_error = approval.result(timeout=10)

        self.assertEqual(str(approval_error['code']), 'JOB_APPROVAL_BLOCKED')
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.PENDING)
        self.assertFalse(active_jobs_queryset().filter(pk=self.job.pk).exists())

    def test_approval_commits_first_then_revoke_repreviews_links_and_hides_job(self):
        stale_impact = self._impact()
        approval_locked = Event()
        allow_approval = Event()
        revoke_attempted = Event()

        def pause_approval_token(job, review_token):
            del job, review_token
            approval_locked.set()
            if not allow_approval.wait(timeout=10):
                raise AssertionError('Timed out before committing job approval.')

        real_lock = lock_verification_identity

        def signal_revoke_lock(*args, **kwargs):
            revoke_attempted.set()
            return real_lock(*args, **kwargs)

        def revoke_with_repreview():
            close_old_connections()
            try:
                actor = User.objects.get(pk=self.admin.pk)
                case = EmployerVerificationCase.objects.get(pk=self.case.pk)
                try:
                    confirm_verification_lifecycle_action(
                        case,
                        actor=actor,
                        action=EmployerVerificationCase.Status.REVOKED,
                        reason='Concurrency regression revoke.',
                        impact_token=stale_impact['impact_token'],
                    )
                except StaleImpactToken:
                    case.refresh_from_db()
                    fresh = verification_lifecycle_impact(
                        case,
                        actor=actor,
                        action=EmployerVerificationCase.Status.REVOKED,
                        reason='Concurrency regression revoke.',
                    )
                    confirm_verification_lifecycle_action(
                        case,
                        actor=actor,
                        action=EmployerVerificationCase.Status.REVOKED,
                        reason='Concurrency regression revoke.',
                        impact_token=fresh['impact_token'],
                    )
                    return 'stale_then_revoked'
                return 'unexpectedly_not_stale'
            finally:
                close_old_connections()

        with (
            patch(
                'apps.jobs.services.moderation._verify_review_token',
                side_effect=pause_approval_token,
            ),
            patch(
                'apps.employers.services.verification.lock_verification_identity',
                side_effect=signal_revoke_lock,
            ),
            ThreadPoolExecutor(max_workers=2) as pool,
        ):
            approval = pool.submit(self._approve_in_thread)
            self.assertTrue(approval_locked.wait(timeout=10))
            revoke = pool.submit(revoke_with_repreview)
            self.assertTrue(revoke_attempted.wait(timeout=10))
            allow_approval.set()
            self.assertEqual(approval.result(timeout=10), 'approved')
            self.assertEqual(revoke.result(timeout=10), 'stale_then_revoked')

        self.job.refresh_from_db()
        self.case.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.REVOKED)
        self.assertTrue(
            EmployerComplianceHoldJob.objects.filter(
                hold__recruiter=self.recruiter,
                hold__status=EmployerComplianceHold.Status.ACTIVE,
                job=self.job,
            ).exists()
        )
        self.assertFalse(active_jobs_queryset().filter(pk=self.job.pk).exists())
