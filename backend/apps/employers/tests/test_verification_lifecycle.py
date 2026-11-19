"""Revoke/expire of an approved case, compliance holds and stale impact tokens."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError

from apps.accounts.services import StaleImpactToken
from apps.campaigns.models import RecruitmentCampaign
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

from ..models import (
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerComplianceHold,
    EmployerComplianceHoldJob,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ..services import (
    confirm_verification_decision,
    lock_verification_identity,
    record_verification_upload,
    recruiter_job_publication_state,
    recruiter_readiness_state,
    release_verification_holds,
    review_verification_document,
    start_verification_review,
    verification_decision_impact,
    verification_lifecycle_impact,
)
from .cases import VerificationStateMachineTestCase


class EmployerVerificationLifecycleTests(VerificationStateMachineTestCase):
    def test_revoke_updates_recruiter_case_and_holds_without_company_impact(self):
        self._approve()
        visible = self.client.get(reverse('job-list'))
        self.assertEqual(visible.data['count'], 1)

        impact = self._revoke()

        self.case.refresh_from_db()
        self.job.refresh_from_db()
        hold = EmployerComplianceHold.objects.get(
            recruiter=self.recruiter,
            source=EmployerComplianceHold.Source.VERIFICATION,
            status=EmployerComplianceHold.Status.ACTIVE,
        )
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.REVOKED)
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertTrue(hold.job_links.filter(job=self.job).exists())
        self.assertNotIn('company_impact', impact)
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
            **open_visibility_window(),
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 policy held job',
            description='Policy held.',
            status=Job.Status.ACTIVE,
            policy_hold=Job.PolicyHold.TEMPORARY_LOCK,
            **open_visibility_window(),
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 moderation held job',
            description='Moderation held.',
            status=Job.Status.ACTIVE,
            moderation_hold=Job.ModerationHold.MANUAL_REVIEW,
            **open_visibility_window(),
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
            **open_visibility_window(),
        )
        other_held_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 DPA held job',
            description='Other source hold.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
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
            actor=self.reviewer,
            action=EmployerVerificationCase.Status.REVOKED,
            reason='Rà soát lại bằng chứng đại diện.',
        )

        self.assertEqual(impact['resources']['job_count'], 6)
        self.assertEqual(impact['resources']['active_jobs_hidden_from_public'], 1)

    def test_manual_expire_updates_recruiter_case_and_uses_expired_hold(self):
        self._approve()
        self._revoke(action=EmployerVerificationCase.Status.EXPIRED)

        self.case.refresh_from_db()
        hold = EmployerComplianceHold.objects.get(recruiter=self.recruiter)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.EXPIRED)
        self.assertEqual(
            hold.reason,
            EmployerComplianceHold.Reason.VERIFICATION_EXPIRED,
        )

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
        company_snapshot = self._company_snapshot()
        self.case = confirm_verification_decision(
            self.case,
            actor=self.reviewer,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            impact_token=preview['impact_token'],
        )
        self.assertNotIn('company_impact', preview)
        self.assertNotIn('company_impact', self.case.decision_snapshot)
        self.assertEqual(self._company_snapshot(), company_snapshot)

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
        job_publication = recruiter_job_publication_state(
            self.employer,
            company_id=self.company.pk,
        )
        self.assertEqual(
            [blocker['code'] for blocker in job_publication['publish_blockers']],
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


class EmployerVerificationImpactTokenTests(VerificationStateMachineTestCase):
    """A confirmation is refused when what its preview hashed has changed."""

    def test_same_count_job_replacement_stales_lifecycle_snapshot(self):
        self._approve()
        self.client.force_authenticate(self.reviewer)
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
            **open_visibility_window(),
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
            **open_visibility_window(),
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
