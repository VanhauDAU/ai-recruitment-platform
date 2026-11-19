"""Claiming due sources and consolidating them into one digest."""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.candidates.models import (
    CandidateConsent,
    CandidateEmailNotificationSettings,
    CandidateJobPreference,
)
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.sitecontent.models import SiteSetting

from ..models import (
    CandidateJobDigest,
    CandidateJobDigestSchedule,
    CandidateJobEmailReceipt,
    CandidateJobEmailSuppression,
    Job,
    JobAlert,
)
from ..services import (
    create_job_alert,
    reset_candidate_job_delivery_cursors,
    update_job_alert,
)
from ..services.digests import (
    claim_due_candidate_job_digest_candidates,
    due_candidate_ids,
    prepare_candidate_job_digest,
)
from ..services.digests.scheduling import PREPARATION_CLAIM_LEASE
from .factories import enable_email_notifications, open_visibility_window


class CandidateJobDigestPreparationTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.candidate = User.objects.create_user(
            email='digest-prepare@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self.employer = User.objects.create_user(
            email='digest-prepare-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Digest Prepare Company',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        enable_email_notifications()

    def _job(self, title, *, minutes_old=5):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=self.now - timedelta(minutes=minutes_old),
            **open_visibility_window(),
        )

    def _due_alert(self, keyword):
        alert = create_job_alert(self.candidate, {'keyword': keyword})
        alert.cursor_at = self.now - timedelta(days=2)
        alert.next_run_at = self.now - timedelta(seconds=1)
        alert.save(update_fields=['cursor_at', 'next_run_at', 'updated_at'])
        return alert

    def _candidate_with_due_alert(self, index):
        candidate = User.objects.create_user(
            email=f'digest-page-{index}@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        alert = create_job_alert(candidate, {'keyword': f'Page {index}'})
        JobAlert.objects.filter(pk=alert.pk).update(
            cursor_at=self.now - timedelta(days=2),
            next_run_at=self.now - timedelta(seconds=1),
        )
        return candidate

    @patch('apps.jobs.services.digests.scheduling.MAX_DUE_CANDIDATES', 2)
    def test_claimed_page_advances_to_later_ids_and_stale_leases_are_reclaimed(self):
        first = self.candidate
        self._due_alert('Page first')
        second = self._candidate_with_due_alert(2)
        third = self._candidate_with_due_alert(3)

        first_page = claim_due_candidate_job_digest_candidates(self.now)
        second_page = claim_due_candidate_job_digest_candidates(self.now)

        self.assertEqual(
            [claim['candidate_id'] for claim in first_page],
            [first.pk, second.pk],
        )
        self.assertEqual(
            [claim['candidate_id'] for claim in second_page],
            [third.pk],
        )

        reclaimed = claim_due_candidate_job_digest_candidates(
            self.now + PREPARATION_CLAIM_LEASE + timedelta(seconds=1)
        )
        self.assertEqual(
            [claim['candidate_id'] for claim in reclaimed],
            [first.pk, second.pk],
        )

    def test_opted_out_and_soft_disabled_sources_are_not_scheduler_candidates(self):
        self._due_alert('Opted out')
        profile = self.candidate.candidate_profile
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile,
            configured_job_alerts=False,
            suitable_job_recommendations=True,
        )
        CandidateJobDigestSchedule.objects.create(
            candidate=self.candidate,
            suitable_cursor_at=self.now - timedelta(days=7),
            suitable_next_run_at=self.now - timedelta(seconds=1),
        )

        self.assertNotIn(self.candidate.pk, due_candidate_ids(self.now))
        self.assertEqual(claim_due_candidate_job_digest_candidates(self.now), [])
        self.assertFalse(
            CandidateJobDigestSchedule.objects.filter(candidate=self.candidate).exists()
        )

    @patch('apps.jobs.services.digests.preparation.recommend_new_jobs_for_candidate_email')
    def test_consolidates_round_robin_sources_and_cross_flow_dedupes_at_ten(self, recommend):
        alpha_alert = self._due_alert('Alpha')
        beta_alert = self._due_alert('Beta')
        common = self._job('Alpha Beta Common', minutes_old=1)
        for index in range(6):
            self._job(f'Alpha role {index}', minutes_old=10 + index)
            self._job(f'Beta role {index}', minutes_old=20 + index)
        suitable_only = self._job('Gamma suitable', minutes_old=2)

        profile = self.candidate.candidate_profile
        profile.job_preferences_configured = True
        profile.save(update_fields=['job_preferences_configured', 'updated_at'])
        CandidateJobPreference.objects.create(candidate_profile=profile)
        CandidateConsent.objects.create(
            candidate_profile=profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
        )
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile,
            configured_job_alerts=True,
            suitable_job_recommendations=True,
        )
        CandidateJobDigestSchedule.objects.create(
            candidate=self.candidate,
            suitable_cursor_at=self.now - timedelta(days=7),
            suitable_next_run_at=self.now - timedelta(seconds=1),
        )
        recommend.return_value = {
            'status': 'ready',
            'results': [
                {'job': common, 'match_score': 90, 'match_reasons': ['Khớp hồ sơ']},
                {
                    'job': suitable_only,
                    'match_score': 80,
                    'match_reasons': ['Khớp kỹ năng'],
                },
            ],
        }

        digest = prepare_candidate_job_digest(self.candidate.pk, self.now)

        self.assertEqual(digest.status, CandidateJobDigest.Status.PENDING)
        items = list(digest.items.order_by('sort_order'))
        self.assertEqual(len(items), 10)
        self.assertEqual(len({(item.job_id, item.job_published_at) for item in items}), 10)
        common_item = next(item for item in items if item.job_id == common.pk)
        self.assertEqual(
            set(common_item.source_alert_public_ids),
            {alpha_alert.public_id, beta_alert.public_id},
        )
        self.assertTrue(common_item.includes_suitable_recommendation)
        self.assertIn(suitable_only.pk, {item.job_id for item in items})
        self.assertTrue(
            any(alpha_alert.public_id in item.source_alert_public_ids for item in items)
        )
        self.assertTrue(any(beta_alert.public_id in item.source_alert_public_ids for item in items))
        alpha_alert.refresh_from_db()
        beta_alert.refresh_from_db()
        self.assertEqual(alpha_alert.cursor_at, self.now - timedelta(days=2))
        self.assertEqual(beta_alert.cursor_at, self.now - timedelta(days=2))

        sent_at = self.now + timedelta(minutes=1)
        CandidateJobEmailReceipt.objects.bulk_create(
            [
                CandidateJobEmailReceipt(
                    candidate=self.candidate,
                    job=item.job,
                    job_published_at=item.job_published_at,
                    digest=digest,
                    sent_at=sent_at,
                )
                for item in items
            ]
        )
        CandidateJobEmailSuppression.objects.bulk_create(
            [
                CandidateJobEmailSuppression(
                    candidate=self.candidate,
                    job=item.job,
                    first_sent_at=sent_at,
                )
                for item in items
            ]
        )
        digest.status = CandidateJobDigest.Status.SENT
        digest.sent_at = sent_at
        digest.save(update_fields=['status', 'sent_at', 'updated_at'])
        later = self.now + timedelta(days=1)
        JobAlert.objects.filter(pk__in=[alpha_alert.pk, beta_alert.pk]).update(
            next_run_at=later - timedelta(seconds=1)
        )
        CandidateJobDigestSchedule.objects.filter(candidate=self.candidate).update(
            suitable_next_run_at=later - timedelta(seconds=1)
        )
        recommend.return_value = {'status': 'ready', 'results': []}

        next_digest = prepare_candidate_job_digest(self.candidate.pk, later)
        next_job_ids = set(next_digest.items.values_list('job_id', flat=True))
        self.assertTrue(next_job_ids)
        self.assertTrue(next_job_ids.isdisjoint({item.job_id for item in items}))
        self.assertLessEqual(len(next_job_ids), 10)

    def test_site_off_advances_checkpoint_and_reenable_has_no_backlog(self):
        alert = self._due_alert('Disabled period')
        disabled_period_job = self._job('Disabled period engineer', minutes_old=1)
        SiteSetting.objects.filter(key='email_notifications_enabled').update(value=False)

        with patch('apps.jobs.services.digests.preparation._strict_source_queue') as source_queue:
            claims = claim_due_candidate_job_digest_candidates(self.now)
            source_queue.assert_not_called()

        self.assertEqual(claims, [])
        self.assertFalse(CandidateJobDigest.objects.filter(candidate=self.candidate).exists())
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, self.now)
        self.assertGreater(alert.next_run_at, self.now)

        SiteSetting.objects.filter(key='email_notifications_enabled').update(value=True)
        later = self.now + timedelta(days=1)
        JobAlert.objects.filter(pk=alert.pk).update(next_run_at=later - timedelta(seconds=1))
        resumed = prepare_candidate_job_digest(self.candidate.pk, later)

        self.assertEqual(resumed.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(resumed.items.filter(job=disabled_period_job).exists())

    def test_paused_alert_is_not_swept_and_resume_excludes_disabled_period(self):
        alert = self._due_alert('Paused period')
        alert.is_active = False
        alert.save(update_fields=['is_active', 'updated_at'])
        disabled_period_job = self._job('Paused period engineer', minutes_old=1)

        skipped = prepare_candidate_job_digest(self.candidate.pk, self.now)
        self.assertIsNone(skipped)
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, self.now - timedelta(days=2))

        resume_time = self.now + timedelta(hours=1)
        with patch('apps.jobs.services.alerts.timezone.now', return_value=resume_time):
            update_job_alert(self.candidate, alert, {'is_active': True})
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, resume_time)

        later = resume_time + timedelta(days=1)
        JobAlert.objects.filter(pk=alert.pk).update(next_run_at=later - timedelta(seconds=1))
        resumed = prepare_candidate_job_digest(self.candidate.pk, later)
        self.assertEqual(resumed.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(resumed.items.filter(job=disabled_period_job).exists())

    def test_configured_master_resume_resets_all_alert_cursors(self):
        first = self._due_alert('Master A')
        second = self._due_alert('Master B')
        resume_time = self.now + timedelta(hours=2)

        with patch('apps.jobs.services.alerts.timezone.now', return_value=resume_time):
            reset_candidate_job_delivery_cursors(self.candidate, configured=True)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.cursor_at, resume_time)
        self.assertEqual(second.cursor_at, resume_time)
        self.assertGreater(first.next_run_at, resume_time)
        self.assertGreater(second.next_run_at, resume_time)

    def test_eligible_empty_window_keeps_cursor_and_drains_late_visible_job(self):
        alert = self._due_alert('Late visible')
        original_cursor = alert.cursor_at

        empty = prepare_candidate_job_digest(self.candidate.pk, self.now)

        self.assertEqual(empty.status, CandidateJobDigest.Status.EMPTY)
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, original_cursor)

        late_visible = self._job('Late visible engineer', minutes_old=1)
        later = self.now + timedelta(days=1)
        JobAlert.objects.filter(pk=alert.pk).update(next_run_at=later - timedelta(seconds=1))
        drained = prepare_candidate_job_digest(self.candidate.pk, later)

        self.assertEqual(drained.status, CandidateJobDigest.Status.PENDING)
        self.assertTrue(drained.items.filter(job=late_visible).exists())
