import json
from datetime import timedelta
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.jobs.models import Job

from ..models import (
    DpaStatus,
    EmployerComplianceHold,
    EmployerComplianceHoldJob,
    RecruitmentCampaign,
)
from ..models.readiness import current_dpa_status
from ..services import (
    DpaPolicyUnavailable,
    accept_recruiter_dpa,
    apply_expired_dpa_holds_batch,
    apply_expired_recruiter_dpa_hold,
    start_recruiter_dpa_grace,
)
from .readiness_helpers import make_employer_ready


class EmployerDpaGraceHoldTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='dpa-grace@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.recruiter = make_employer_ready(self.user, candidate_data=True)
        self.company = self.recruiter.company
        self.case = self.recruiter.verification_case
        self.recruiter.dpa_acceptances.all().delete()
        self.recruiter.dpa_policy_version = ''
        self.recruiter.dpa_document_sha256 = ''
        self.recruiter.save(
            update_fields=['dpa_policy_version', 'dpa_document_sha256', 'updated_at']
        )
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='DPA grace campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            campaign=self.campaign,
            title='DPA grace job',
            description='DPA grace test.',
            status=Job.Status.ACTIVE,
        )

    def expire_grace(self):
        expired = timezone.now() - timedelta(seconds=1)
        self.recruiter.dpa_grace_started_at = expired - timedelta(days=30)
        self.recruiter.dpa_grace_expires_at = expired
        self.recruiter.save(
            update_fields=[
                'dpa_grace_started_at',
                'dpa_grace_expires_at',
                'updated_at',
            ]
        )

    def test_legacy_moves_to_grace_then_hold_after_exact_30_days(self):
        self.assertEqual(current_dpa_status(self.recruiter), DpaStatus.LEGACY_UNVERSIONED)
        started_at = timezone.now()

        recruiter, created = start_recruiter_dpa_grace(
            self.recruiter,
            rollout_id='dpa-legacy-2026-08',
            started_at=started_at,
        )

        self.assertTrue(created)
        self.assertEqual(current_dpa_status(recruiter), DpaStatus.GRACE)
        self.assertEqual(
            recruiter.dpa_grace_expires_at,
            started_at + timedelta(days=30),
        )
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse('employer-me'))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['dpa_status'], DpaStatus.GRACE)
        self.assertEqual(
            response.data['dpa_grace_expires_at'],
            recruiter.dpa_grace_expires_at.isoformat().replace('+00:00', 'Z'),
        )
        self.expire_grace()
        self.recruiter.refresh_from_db()
        self.assertEqual(current_dpa_status(self.recruiter), DpaStatus.HOLD)

    def test_expired_grace_applies_idempotent_dpa_hold_and_resource_links(self):
        start_recruiter_dpa_grace(self.recruiter, rollout_id='dpa-rollout-1')
        self.expire_grace()

        first, created = apply_expired_recruiter_dpa_hold(self.recruiter)
        second, created_again = apply_expired_recruiter_dpa_hold(self.recruiter)

        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(first.source, EmployerComplianceHold.Source.DPA)
        self.assertEqual(first.reason, EmployerComplianceHold.Reason.DPA_HOLD)
        self.assertEqual(first.metadata['rollout_id'], 'dpa-rollout-1')
        self.assertTrue(first.campaign_links.filter(campaign=self.campaign).exists())
        self.assertTrue(first.job_links.filter(job=self.job).exists())

    def test_dpa_hold_is_not_applied_before_grace_expires(self):
        start_recruiter_dpa_grace(self.recruiter, rollout_id='dpa-rollout-future')

        hold, created = apply_expired_recruiter_dpa_hold(self.recruiter)

        self.assertIsNone(hold)
        self.assertFalse(created)
        self.assertFalse(EmployerComplianceHold.objects.exists())

    def test_reconsent_releases_only_dpa_hold_and_clears_grace(self):
        start_recruiter_dpa_grace(self.recruiter, rollout_id='dpa-rollout-2')
        self.expire_grace()
        dpa_hold, _ = apply_expired_recruiter_dpa_hold(self.recruiter)
        verification_hold = EmployerComplianceHold.objects.create(
            recruiter=self.recruiter,
            verification_case=self.case,
            source=EmployerComplianceHold.Source.VERIFICATION,
            reason=EmployerComplianceHold.Reason.VERIFICATION_REVOKED,
            applied_by=self.user,
        )
        EmployerComplianceHoldJob.objects.create(hold=verification_hold, job=self.job)

        recruiter = accept_recruiter_dpa(
            self.user,
            expected_policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
            expected_document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
            ip_address='203.0.113.20',
        )

        dpa_hold.refresh_from_db()
        verification_hold.refresh_from_db()
        self.assertEqual(dpa_hold.status, EmployerComplianceHold.Status.RELEASED)
        self.assertEqual(verification_hold.status, EmployerComplianceHold.Status.ACTIVE)
        self.assertIsNone(recruiter.dpa_grace_started_at)
        self.assertIsNone(recruiter.dpa_grace_expires_at)
        self.assertEqual(recruiter.dpa_grace_rollout_id, '')
        self.assertEqual(current_dpa_status(recruiter), DpaStatus.CURRENT)

    def test_rollout_command_is_dry_run_first_and_apply_is_idempotent(self):
        output = StringIO()
        call_command(
            'rollout_employer_dpa_compliance',
            phase='start-grace',
            rollout_id='dpa-command-1',
            stdout=output,
        )
        self.recruiter.refresh_from_db()
        self.assertIsNone(self.recruiter.dpa_grace_expires_at)
        self.assertEqual(json.loads(output.getvalue())['selected'], 1)

        for _ in range(2):
            call_command(
                'rollout_employer_dpa_compliance',
                phase='start-grace',
                rollout_id='dpa-command-1',
                apply=True,
                stdout=StringIO(),
            )
        self.recruiter.refresh_from_db()
        first_expiry = self.recruiter.dpa_grace_expires_at
        self.assertIsNotNone(first_expiry)
        call_command(
            'rollout_employer_dpa_compliance',
            phase='start-grace',
            rollout_id='dpa-command-1',
            apply=True,
            stdout=StringIO(),
        )
        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.dpa_grace_expires_at, first_expiry)

    def test_expired_hold_command_is_dry_run_first_and_apply_is_idempotent(self):
        start_recruiter_dpa_grace(self.recruiter, rollout_id='dpa-command-hold')
        self.expire_grace()
        output = StringIO()

        call_command(
            'rollout_employer_dpa_compliance',
            phase='expired-holds',
            rollout_id='dpa-command-hold',
            stdout=output,
        )

        self.assertEqual(json.loads(output.getvalue())['selected'], 1)
        self.assertFalse(EmployerComplianceHold.objects.exists())
        for _ in range(2):
            call_command(
                'rollout_employer_dpa_compliance',
                phase='expired-holds',
                rollout_id='dpa-command-hold',
                apply=True,
                stdout=StringIO(),
            )
        self.assertEqual(
            EmployerComplianceHold.objects.filter(
                source=EmployerComplianceHold.Source.DPA,
                status=EmployerComplianceHold.Status.ACTIVE,
            ).count(),
            1,
        )

    @override_settings(EMPLOYER_DPA_POLICY_VERSION='')
    def test_rollout_command_fails_closed_when_policy_is_not_configured(self):
        with self.assertRaisesMessage(
            CommandError,
            'DPA hiện hành chưa được cấu hình đầy đủ.',
        ):
            call_command(
                'rollout_employer_dpa_compliance',
                phase='start-grace',
                rollout_id='dpa-invalid-policy',
                stdout=StringIO(),
            )

    @override_settings(EMPLOYER_DPA_POLICY_VERSION='')
    def test_grace_service_fails_closed_when_policy_is_not_configured(self):
        with self.assertRaises(DpaPolicyUnavailable):
            start_recruiter_dpa_grace(
                self.recruiter,
                rollout_id='dpa-invalid-policy',
            )


class EmployerDpaHoldBatchQueryBudgetTests(APITestCase):
    def make_expired(self, index):
        user = User.objects.create_user(
            email=f'dpa-batch-{index}@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        recruiter = make_employer_ready(user, candidate_data=True)
        recruiter.dpa_policy_version = ''
        recruiter.dpa_document_sha256 = ''
        recruiter.dpa_grace_started_at = timezone.now() - timedelta(days=31)
        recruiter.dpa_grace_expires_at = timezone.now() - timedelta(days=1)
        recruiter.dpa_grace_rollout_id = 'dpa-query-budget'
        recruiter.save(
            update_fields=[
                'dpa_policy_version',
                'dpa_document_sha256',
                'dpa_grace_started_at',
                'dpa_grace_expires_at',
                'dpa_grace_rollout_id',
                'updated_at',
            ]
        )
        campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=recruiter.company,
            name=f'DPA batch {index}',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        Job.objects.create(
            posted_by=user,
            company=recruiter.company,
            campaign=campaign,
            title=f'DPA batch job {index}',
            description='Query budget.',
            status=Job.Status.ACTIVE,
        )
        return recruiter

    @staticmethod
    def query_count(callback):
        with CaptureQueriesContext(connection) as captured:
            callback()
        return len(captured)

    def test_batch_queries_are_flat(self):
        first = self.make_expired(1)
        baseline = self.query_count(
            lambda: apply_expired_dpa_holds_batch(
                [first.pk],
                rollout_id='dpa-query-budget',
            )
        )
        cohort = [self.make_expired(index) for index in range(2, 22)]
        expanded = self.query_count(
            lambda: apply_expired_dpa_holds_batch(
                [recruiter.pk for recruiter in cohort],
                rollout_id='dpa-query-budget',
            )
        )

        self.assertEqual(expanded, baseline)
        self.assertLessEqual(expanded, 10)
