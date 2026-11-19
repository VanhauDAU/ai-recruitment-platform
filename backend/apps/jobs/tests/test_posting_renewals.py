"""Keeping a job public: deadline extensions, visibility renewals and reopening."""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from common.vietnam_time import vietnam_today

from ..models import Job
from ..services import (
    RESPONSIBILITY_STATEMENT_VERSION,
    close_job,
    extend_job_deadline,
    publish_job,
    reopen_job,
)
from .factories import JobPostingFixture

ACCEPTED = {'accepted_statement_version': RESPONSIBILITY_STATEMENT_VERSION}
ENTITLEMENT = 'apps.jobs.services.posting.quota.recruiter_job_posting_entitlement'


class JobRenewalTests(JobPostingFixture, TestCase):
    @patch(ENTITLEMENT)
    def test_publish_accepts_ninety_days_and_rejects_day_ninety_one(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        today = vietnam_today()
        accepted = self.make_publishable_job(title='Accepted 90-day deadline')
        accepted.deadline = today + timedelta(days=90)
        accepted.save(update_fields=['deadline'])

        published = publish_job(accepted, self.user, **ACCEPTED)

        self.assertEqual(published.status, Job.Status.ACTIVE)
        self.assertEqual(published.deadline, today + timedelta(days=90))

        rejected = self.make_publishable_job(title='Rejected 91-day deadline')
        rejected.deadline = today + timedelta(days=91)
        rejected.save(update_fields=['deadline'])

        with self.assertRaises(ValidationError) as context:
            publish_job(rejected, self.user, **ACCEPTED)

        self.assertIn('deadline', context.exception.detail)
        rejected.refresh_from_db()
        self.assertEqual(rejected.status, Job.Status.DRAFT)

    def test_deadline_extension_requires_a_strictly_later_deadline(self):
        today = vietnam_today()
        job = self.make_active_job(deadline=today + timedelta(days=10))

        for invalid_deadline in (job.deadline, today + timedelta(days=5)):
            with self.subTest(deadline=invalid_deadline):
                with self.assertRaises(ValidationError):
                    extend_job_deadline(job, self.user, invalid_deadline)

        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=10))
        self.assertEqual(job.status, Job.Status.ACTIVE)

    def test_visibility_extension_uses_immutable_cycle_anchor(self):
        job = self.make_active_job(deadline=vietnam_today() + timedelta(days=35))
        anchor = timezone.now() - timedelta(days=10)
        job.first_approved_at = anchor
        job.visibility_starts_at = anchor
        job.visibility_ends_at = anchor + timedelta(days=30)
        job.requested_visibility_days = 30
        job.save(
            update_fields=[
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
                'requested_visibility_days',
            ]
        )

        extended = extend_job_deadline(
            job,
            self.user,
            job.deadline,
            requested_visibility_days=45,
        )

        self.assertEqual(extended.first_approved_at, anchor)
        self.assertEqual(extended.visibility_starts_at, anchor)
        self.assertEqual(extended.visibility_ends_at, anchor + timedelta(days=45))
        self.assertEqual(extended.requested_visibility_days, 45)

    def test_deadline_extension_cannot_exceed_internal_visibility(self):
        today = vietnam_today()
        job = self.make_active_job(deadline=today + timedelta(days=5))
        anchor = timezone.now()
        job.first_approved_at = anchor
        job.visibility_starts_at = anchor
        job.visibility_ends_at = anchor + timedelta(days=10)
        job.save(
            update_fields=[
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
            ]
        )

        with self.assertRaises(ValidationError) as context:
            extend_job_deadline(job, self.user, today + timedelta(days=11))

        self.assertIn('deadline', context.exception.detail)
        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=5))

    def test_deadline_and_visibility_can_be_extended_atomically(self):
        today = vietnam_today()
        job = self.make_active_job(deadline=today + timedelta(days=5))
        anchor = timezone.now()
        job.first_approved_at = anchor
        job.visibility_starts_at = anchor
        job.visibility_ends_at = anchor + timedelta(days=10)
        job.requested_visibility_days = 10
        job.save(
            update_fields=[
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
                'requested_visibility_days',
            ]
        )

        extended = extend_job_deadline(
            job,
            self.user,
            today + timedelta(days=14),
            requested_visibility_days=14,
        )

        self.assertEqual(extended.deadline, today + timedelta(days=14))
        self.assertEqual(extended.visibility_ends_at, anchor + timedelta(days=14))

    def test_deadline_extension_accepts_ninety_day_boundary_and_rejects_later_date(self):
        today = vietnam_today()
        accepted = self.make_active_job(
            deadline=today + timedelta(days=10),
            published_at=timezone.now(),
        )

        extended = extend_job_deadline(accepted, self.user, today + timedelta(days=90))

        self.assertEqual(extended.deadline, today + timedelta(days=90))
        self.assertEqual(extended.status, Job.Status.ACTIVE)

        rejected = self.make_active_job(
            deadline=today + timedelta(days=10),
            published_at=timezone.now(),
        )
        with self.assertRaises(ValidationError):
            extend_job_deadline(rejected, self.user, today + timedelta(days=91))
        rejected.refresh_from_db()
        self.assertEqual(rejected.deadline, today + timedelta(days=10))

    def test_deadline_extension_cannot_exceed_ninety_day_public_lifetime(self):
        today = vietnam_today()
        boundary = self.make_active_job(
            deadline=today + timedelta(days=5),
            published_at=timezone.now() - timedelta(days=60),
        )

        extended = extend_job_deadline(boundary, self.user, today + timedelta(days=30))

        self.assertEqual(extended.deadline, today + timedelta(days=30))

        over_lifetime = self.make_active_job(
            deadline=today + timedelta(days=5),
            published_at=timezone.now() - timedelta(days=61),
        )
        with self.assertRaises(ValidationError):
            extend_job_deadline(over_lifetime, self.user, today + timedelta(days=30))
        over_lifetime.refresh_from_db()
        self.assertEqual(over_lifetime.deadline, today + timedelta(days=5))

    def test_expired_active_job_within_grace_is_renewed_without_leaving_public(self):
        today = vietnam_today()
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Backend hiring',
            status=RecruitmentCampaign.Status.ACTIVE,
            start_date=today - timedelta(days=60),
            target_date=today + timedelta(days=60),
        )
        job = self.make_active_job(
            deadline=today - timedelta(days=30),
            published_at=timezone.now() - timedelta(days=60),
            campaign=campaign,
        )

        renewed = extend_job_deadline(job, self.user, today + timedelta(days=30))

        self.assertEqual(renewed.deadline, today + timedelta(days=30))
        self.assertEqual(renewed.status, Job.Status.ACTIVE)
        self.assertEqual(renewed.published_at, job.published_at)
        self.assertFalse(renewed.status_history.exists())
        self.assertTrue(
            CampaignActivity.objects.filter(
                campaign=campaign,
                event_type=CampaignActivity.EventType.JOB_UPDATED,
                subject_public_id=job.public_id,
            ).exists()
        )

    def test_expired_active_job_outside_thirty_day_grace_cannot_be_renewed(self):
        today = vietnam_today()
        job = self.make_active_job(
            deadline=today - timedelta(days=31),
            published_at=timezone.now() - timedelta(days=61),
        )

        with self.assertRaises(ValidationError):
            extend_job_deadline(job, self.user, today + timedelta(days=29))

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)
        self.assertEqual(job.deadline, today - timedelta(days=31))
        self.assertIsNotNone(job.published_at)
        self.assertFalse(job.status_history.exists())

    def test_campaign_target_caps_extension_and_inactive_campaign_rejects_it(self):
        today = vietnam_today()
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Time-boxed hiring',
            status=RecruitmentCampaign.Status.ACTIVE,
            start_date=today,
            target_date=today + timedelta(days=20),
        )
        job = self.make_active_job(
            deadline=today + timedelta(days=5),
            campaign=campaign,
        )

        with self.assertRaises(ValidationError):
            extend_job_deadline(job, self.user, today + timedelta(days=21))

        campaign.status = RecruitmentCampaign.Status.PAUSED
        campaign.save(update_fields=['status'])
        with self.assertRaises(ValidationError):
            extend_job_deadline(job, self.user, today + timedelta(days=15))

        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=5))

    def test_owner_reopens_a_closed_job_and_it_is_public_again(self):
        job = self.make_publishable_job()
        job.status = Job.Status.ACTIVE
        job.published_at = timezone.now()
        job.save(update_fields=['status', 'published_at'])

        closed = close_job(job, self.user)
        self.assertEqual(closed.status, Job.Status.CLOSED)
        reopened_deadline = vietnam_today() + timedelta(days=21)
        reopened = reopen_job(closed, self.user, reopened_deadline, **ACCEPTED)

        self.assertEqual(reopened.status, Job.Status.ACTIVE)
        self.assertEqual(reopened.deadline, reopened_deadline)
        self.assertIsNone(reopened.closed_at)
        self.assertIsNotNone(reopened.published_at)
        self.assertEqual(reopened.approved_at, reopened.published_at)
        self.assertEqual(
            list(reopened.status_history.values_list('from_status', 'to_status')),
            [
                (Job.Status.CLOSED, Job.Status.ACTIVE),
                (Job.Status.ACTIVE, Job.Status.CLOSED),
            ],
        )

    def test_reopen_requires_the_commitment_and_records_it_again(self):
        closed = close_job(self.make_active_job(), self.user)
        deadline = vietnam_today() + timedelta(days=21)

        with self.assertRaises(ValidationError) as context:
            reopen_job(closed, self.user, deadline)

        self.assertEqual(str(context.exception.detail['code']), 'JOB_RESPONSIBILITY_REQUIRED')
        closed.refresh_from_db()
        self.assertEqual(closed.status, Job.Status.CLOSED)
        self.assertIsNone(closed.responsibility_accepted_at)

        reopened = reopen_job(closed, self.user, deadline, **ACCEPTED)

        self.assertEqual(reopened.responsibility_accepted_at, reopened.published_at)
        self.assertEqual(
            reopened.responsibility_statement_version,
            RESPONSIBILITY_STATEMENT_VERSION,
        )

    def test_reopen_accepts_ninety_days_and_rejects_day_ninety_one(self):
        today = vietnam_today()
        accepted = self.make_active_job()
        accepted = close_job(accepted, self.user)

        reopened = reopen_job(accepted, self.user, today + timedelta(days=90), **ACCEPTED)

        self.assertEqual(reopened.status, Job.Status.ACTIVE)
        self.assertEqual(reopened.deadline, today + timedelta(days=90))

        rejected = self.make_active_job()
        rejected = close_job(rejected, self.user)
        with self.assertRaises(ValidationError) as context:
            reopen_job(rejected, self.user, today + timedelta(days=91), **ACCEPTED)

        self.assertIn('deadline', context.exception.detail)
        rejected.refresh_from_db()
        self.assertEqual(rejected.status, Job.Status.CLOSED)

    def test_reopen_cannot_extend_past_the_ninety_day_public_lifetime(self):
        today = vietnam_today()
        job = self.make_active_job()
        job.first_approved_at = job.visibility_starts_at = timezone.now() - timedelta(days=80)
        job.visibility_ends_at = timezone.now() + timedelta(days=10)
        job.save(update_fields=['first_approved_at', 'visibility_starts_at', 'visibility_ends_at'])
        closed = close_job(job, self.user)

        with self.assertRaises(ValidationError) as context:
            reopen_job(closed, self.user, today + timedelta(days=20), **ACCEPTED)

        self.assertIn('nhân bản tin', str(context.exception.detail['deadline']))
        closed.refresh_from_db()
        self.assertEqual(closed.status, Job.Status.CLOSED)

    def test_reopen_keeps_the_deadline_inside_the_visibility_window(self):
        today = vietnam_today()
        job = self.make_active_job()
        job.visibility_ends_at = timezone.now() + timedelta(days=5)
        job.save(update_fields=['visibility_ends_at'])
        closed = close_job(job, self.user)

        with self.assertRaises(ValidationError) as context:
            reopen_job(closed, self.user, today + timedelta(days=20), **ACCEPTED)

        self.assertIn('vượt thời gian công khai', str(context.exception.detail['deadline']))

    def test_reopening_does_not_consume_another_publication(self):
        job = self.make_active_job()
        submitted_at = job.submitted_at
        closed = close_job(job, self.user)

        reopened = reopen_job(closed, self.user, vietnam_today() + timedelta(days=7), **ACCEPTED)

        self.assertEqual(reopened.submitted_at, submitted_at)

    def test_extending_a_job_without_a_deadline_does_not_crash(self):
        job = self.make_active_job()
        Job.objects.filter(pk=job.pk).update(deadline=None)
        job.refresh_from_db()

        extended = extend_job_deadline(job, self.user, vietnam_today() + timedelta(days=7))

        self.assertEqual(extended.deadline, vietnam_today() + timedelta(days=7))

    def test_extension_is_refused_once_the_employer_loses_the_current_dpa(self):
        job = self.make_active_job()
        self.recruiter.dpa_policy_version = 'old-version'
        self.recruiter.save(update_fields=['dpa_policy_version', 'updated_at'])

        with self.assertRaises(ValidationError) as context:
            extend_job_deadline(job, self.user, job.deadline + timedelta(days=3))

        self.assertEqual(context.exception.detail['code'], 'JOB_PUBLICATION_BLOCKED')

    def test_reopen_cannot_reset_an_expired_visibility_cycle(self):
        job = self.make_active_job()
        job.first_approved_at = timezone.now() - timedelta(days=31)
        job.visibility_starts_at = job.first_approved_at
        job.visibility_ends_at = timezone.now() - timedelta(days=1)
        job.save(update_fields=['first_approved_at', 'visibility_starts_at', 'visibility_ends_at'])
        closed = close_job(job, self.user)

        with self.assertRaises(ValidationError) as context:
            reopen_job(
                closed,
                self.user,
                vietnam_today() + timedelta(days=20),
                **ACCEPTED,
            )

        self.assertEqual(context.exception.detail['code'], 'JOB_VISIBILITY_EXPIRED')
        closed.refresh_from_db()
        self.assertEqual(closed.status, Job.Status.CLOSED)
