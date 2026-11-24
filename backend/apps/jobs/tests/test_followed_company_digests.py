"""Followed-company jobs as a digest source."""

from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.accounts.models import User
from apps.candidates.models import (
    CandidateEmailNotificationSettings,
)
from apps.employers.models import Company, CompanyFollow
from apps.employers.services import follow_company
from apps.employers.tests.factories import make_employer_ready
from apps.sitecontent.models import SiteSetting

from ..models import (
    CandidateFollowedCompanyDigestSchedule,
    CandidateJobDigest,
    CandidateJobDigestItem,
    CandidateJobEmailSuppression,
    Job,
    JobAlert,
)
from ..services import (
    create_job_alert,
    deliver_candidate_job_digest,
    next_job_alert_run,
    reset_candidate_job_delivery_cursors,
)
from ..services.digests import (
    claim_due_candidate_job_digest_candidates,
    due_candidate_ids,
    prepare_candidate_job_digest,
    wake_followed_company_digests,
)
from ..services.digests.scheduling import PREPARATION_CLAIM_LEASE
from .factories import enable_email_notifications, open_visibility_window


class FollowedCompanyDigestSourceTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.candidate = User.objects.create_user(
            email='digest-follower@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self.employer, self.company = self._employer_company('Followed Company')
        enable_email_notifications()

    def _employer_company(self, name):
        employer = User.objects.create_user(
            email=f'{name.lower().replace(" ", "-")}@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(company_name=name, created_by=employer)
        make_employer_ready(employer, company=company, candidate_data=True)
        return employer, company

    def _job(self, title, *, minutes_old=5, employer=None, company=None):
        return Job.objects.create(
            posted_by=employer or self.employer,
            company=company or self.company,
            title=title,
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=self.now - timedelta(minutes=minutes_old),
            **open_visibility_window(),
        )

    def _follow(self, *, candidate=None, company=None, hours_ago=24, notify_new_jobs=True):
        follow = CompanyFollow.objects.create(
            candidate=candidate or self.candidate,
            company=company or self.company,
            notify_new_jobs=notify_new_jobs,
        )
        follow_at = self.now - timedelta(hours=hours_ago)
        CompanyFollow.objects.filter(pk=follow.pk).update(
            created_at=follow_at,
            notify_since=follow_at,
        )
        follow.refresh_from_db()
        return follow

    def _due_schedule(self, candidate=None):
        schedule, _ = CandidateFollowedCompanyDigestSchedule.objects.update_or_create(
            candidate=candidate or self.candidate,
            defaults={
                'cursor_at': self.now - timedelta(days=30),
                'next_run_at': self.now - timedelta(seconds=1),
            },
        )
        return schedule

    def _disable_preference(self):
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=self.candidate.candidate_profile,
            followed_company_jobs=False,
        )

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_only_jobs_published_after_the_follow_are_emailed_once(self, send):
        follow = self._follow(hours_ago=24)
        before_follow = self._job('Posted before follow', minutes_old=48 * 60)
        after_follow = self._job('Posted after follow', minutes_old=5)

        # The scheduler backstop creates the daily schedule; it is not due yet.
        self.assertEqual(claim_due_candidate_job_digest_candidates(self.now), [])
        follow.refresh_from_db()
        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=self.candidate)
        self.assertEqual(schedule.cursor_at, follow.created_at)
        self.assertEqual(
            schedule.next_run_at,
            next_job_alert_run(self.now, JobAlert.Frequency.DAILY),
        )

        self._due_schedule()
        claims = claim_due_candidate_job_digest_candidates(self.now)
        self.assertEqual([claim['candidate_id'] for claim in claims], [self.candidate.pk])
        digest = prepare_candidate_job_digest(
            self.candidate.pk,
            now=claims[0]['claimed_at'],
            claimed_at=claims[0]['claimed_at'],
        )

        self.assertEqual(digest.status, CandidateJobDigest.Status.PENDING)
        self.assertTrue(digest.includes_followed_companies)
        item = digest.items.get()
        self.assertEqual(item.job_id, after_follow.pk)
        self.assertNotEqual(item.job_id, before_follow.pk)
        self.assertEqual(item.source_kind, CandidateJobDigestItem.SourceKind.FOLLOWED_COMPANY)
        self.assertTrue(item.includes_followed_company)

        self.assertEqual(deliver_candidate_job_digest(digest.pk), CandidateJobDigest.Status.SENT)
        send.assert_called_once()
        expected_line = 'Từ công ty bạn theo dõi: Followed Company'
        self.assertIn(expected_line, send.call_args.kwargs['text'])
        self.assertIn(expected_line, send.call_args.kwargs['html'])
        self.assertNotIn('Nguồn:', send.call_args.kwargs['text'])
        self.assertTrue(
            CandidateJobEmailSuppression.objects.filter(
                candidate=self.candidate,
                job=after_follow,
            ).exists()
        )

        later = self.now + timedelta(days=1)
        CandidateFollowedCompanyDigestSchedule.objects.filter(candidate=self.candidate).update(
            next_run_at=later - timedelta(seconds=1)
        )
        second = prepare_candidate_job_digest(self.candidate.pk, later)
        self.assertEqual(second.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(second.items.exists())
        self.assertEqual(send.call_count, 1)

    def test_pending_digest_claims_the_job_until_it_is_delivered(self):
        self._follow()
        self._job('Claimed once')
        self._due_schedule()
        first = prepare_candidate_job_digest(self.candidate.pk, self.now)
        self.assertEqual(first.status, CandidateJobDigest.Status.PENDING)

        later = self.now + timedelta(minutes=1)
        self._due_schedule()
        second = prepare_candidate_job_digest(self.candidate.pk, later)

        self.assertEqual(second.status, CandidateJobDigest.Status.EMPTY)

    def test_muted_follow_is_excluded(self):
        self._follow(notify_new_jobs=False)
        self._job('Muted company role')
        self._due_schedule()

        self.assertNotIn(self.candidate.pk, due_candidate_ids(self.now))
        digest = prepare_candidate_job_digest(self.candidate.pk, self.now)
        self.assertEqual(digest.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(digest.items.exists())

    def test_unmuting_starts_a_new_window_for_that_company(self):
        follow = self._follow(hours_ago=24 * 10)
        CompanyFollow.objects.filter(pk=follow.pk).update(notify_new_jobs=False)
        muted_period_job = self._job('Posted while muted', minutes_old=5 * 24 * 60)
        # Muting every follow leaves the candidate off the due list, so the
        # shared cursor stays where it was until the switch comes back on.
        CandidateFollowedCompanyDigestSchedule.objects.create(
            candidate=self.candidate,
            cursor_at=self.now - timedelta(days=9),
            next_run_at=self.now - timedelta(seconds=1),
        )

        follow_company(company=self.company, candidate=self.candidate, notify_new_jobs=True)
        follow.refresh_from_db()
        self.assertGreater(follow.notify_since, follow.created_at)
        unmuted_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Posted after unmute',
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=follow.notify_since + timedelta(seconds=1),
            **open_visibility_window(),
        )

        digest = prepare_candidate_job_digest(
            self.candidate.pk, unmuted_job.published_at + timedelta(seconds=1)
        )
        self.assertEqual(
            list(digest.items.values_list('job_id', flat=True)),
            [unmuted_job.pk],
        )
        self.assertFalse(digest.items.filter(job=muted_period_job).exists())

    def test_repeating_the_same_email_choice_keeps_the_window(self):
        follow = self._follow()

        follow_company(company=self.company, candidate=self.candidate, notify_new_jobs=True)

        self.assertEqual(
            CompanyFollow.objects.get(pk=follow.pk).notify_since,
            follow.notify_since,
        )

    def test_new_job_makes_the_followers_email_due_now(self):
        self._follow()
        CandidateFollowedCompanyDigestSchedule.objects.create(
            candidate=self.candidate,
            cursor_at=self.now - timedelta(days=1),
            next_run_at=self.now + timedelta(hours=20),
        )

        self.assertEqual(wake_followed_company_digests(self.company.pk, now=self.now), 1)

        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=self.candidate)
        self.assertEqual(schedule.next_run_at, self.now)
        self.assertIn(self.candidate.pk, due_candidate_ids(self.now))

    def test_new_job_creates_a_missing_schedule_due_now(self):
        follow = self._follow()

        wake_followed_company_digests(self.company.pk, now=self.now)

        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=self.candidate)
        self.assertEqual(schedule.next_run_at, self.now)
        self.assertEqual(schedule.cursor_at, follow.notify_since)

    def test_new_job_leaves_muted_followers_and_running_preparations_alone(self):
        self._follow(notify_new_jobs=False)
        later = self.now + timedelta(hours=20)
        CandidateFollowedCompanyDigestSchedule.objects.create(
            candidate=self.candidate,
            cursor_at=self.now - timedelta(days=1),
            next_run_at=later,
        )
        self.assertEqual(wake_followed_company_digests(self.company.pk, now=self.now), 0)

        CompanyFollow.objects.filter(candidate=self.candidate).update(notify_new_jobs=True)
        claimed_at = self.now - timedelta(minutes=1)
        CandidateFollowedCompanyDigestSchedule.objects.filter(candidate=self.candidate).update(
            updated_at=claimed_at,
            next_run_at=claimed_at + PREPARATION_CLAIM_LEASE,
        )
        self.assertEqual(wake_followed_company_digests(self.company.pk, now=self.now), 0)

    def test_preference_off_is_excluded_and_discards_the_window(self):
        self._follow()
        self._job('Preference off role')
        self._due_schedule()
        self._disable_preference()

        self.assertNotIn(self.candidate.pk, due_candidate_ids(self.now))
        self.assertEqual(claim_due_candidate_job_digest_candidates(self.now), [])
        self.assertIsNone(prepare_candidate_job_digest(self.candidate.pk, self.now))
        self.assertFalse(CandidateJobDigest.objects.filter(candidate=self.candidate).exists())
        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=self.candidate)
        self.assertEqual(schedule.cursor_at, self.now)

    def test_preference_resume_starts_a_new_window(self):
        self._follow()
        self._due_schedule()
        resume_time = self.now + timedelta(hours=2)

        with patch('apps.jobs.services.alerts.timezone.now', return_value=resume_time):
            reset_candidate_job_delivery_cursors(self.candidate, followed=True)

        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=self.candidate)
        self.assertEqual(schedule.cursor_at, resume_time)
        self.assertGreater(schedule.next_run_at, resume_time)

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_company_on_content_policy_hold_is_excluded_even_after_preparation(self, send):
        self._follow()
        job = self._job('Held company role')
        self._due_schedule()
        digest = prepare_candidate_job_digest(self.candidate.pk, self.now)
        self.assertEqual(digest.items.get().job_id, job.pk)

        Company.objects.filter(pk=self.company.pk).update(content_policy_hold=True)

        self.assertEqual(
            deliver_candidate_job_digest(digest.pk),
            CandidateJobDigest.Status.CANCELLED,
        )
        send.assert_not_called()
        self.assertNotIn(self.candidate.pk, due_candidate_ids(self.now + timedelta(days=1)))
        later = self.now + timedelta(days=1)
        self._due_schedule()
        held = prepare_candidate_job_digest(self.candidate.pk, later)
        self.assertEqual(held.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(held.items.exists())

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_unfollow_after_preparation_cancels_delivery(self, send):
        follow = self._follow()
        self._job('Unfollowed role')
        self._due_schedule()
        digest = prepare_candidate_job_digest(self.candidate.pk, self.now)
        follow.delete()

        self.assertEqual(
            deliver_candidate_job_digest(digest.pk),
            CandidateJobDigest.Status.CANCELLED,
        )
        send.assert_not_called()

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_site_switch_off_sends_nothing_and_leaves_no_backlog(self, send):
        self._follow()
        disabled_period_job = self._job('Site off role', minutes_old=1)
        self._due_schedule()
        SiteSetting.objects.filter(key='email_notifications_enabled').update(value=False)

        self.assertEqual(claim_due_candidate_job_digest_candidates(self.now), [])

        self.assertFalse(CandidateJobDigest.objects.filter(candidate=self.candidate).exists())
        send.assert_not_called()
        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=self.candidate)
        self.assertEqual(schedule.cursor_at, self.now)
        self.assertGreater(schedule.next_run_at, self.now)

        SiteSetting.objects.filter(key='email_notifications_enabled').update(value=True)
        later = self.now + timedelta(days=1)
        CandidateFollowedCompanyDigestSchedule.objects.filter(candidate=self.candidate).update(
            next_run_at=later - timedelta(seconds=1)
        )
        resumed = prepare_candidate_job_digest(self.candidate.pk, later)
        self.assertEqual(resumed.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(resumed.items.filter(job=disabled_period_job).exists())

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_job_matching_alert_and_followed_company_appears_once(self, send):
        alert = create_job_alert(self.candidate, {'keyword': 'Python'})
        JobAlert.objects.filter(pk=alert.pk).update(
            cursor_at=self.now - timedelta(days=2),
            next_run_at=self.now - timedelta(seconds=1),
        )
        self._follow()
        self._due_schedule()
        both = self._job('Python Engineer', minutes_old=5)
        followed_only = self._job('Kế toán tổng hợp', minutes_old=10)

        digest = prepare_candidate_job_digest(self.candidate.pk, self.now)

        items = {item.job_id: item for item in digest.items.all()}
        self.assertEqual(set(items), {both.pk, followed_only.pk})
        self.assertEqual(digest.job_count, 2)
        self.assertEqual(items[both.pk].source_alert_public_ids, [alert.public_id])
        self.assertTrue(items[both.pk].includes_followed_company)
        self.assertEqual(
            items[followed_only.pk].source_kind,
            CandidateJobDigestItem.SourceKind.FOLLOWED_COMPANY,
        )

        self.assertEqual(deliver_candidate_job_digest(digest.pk), CandidateJobDigest.Status.SENT)
        text = send.call_args.kwargs['text']
        self.assertEqual(text.count('Python Engineer'), 1)
        self.assertEqual(text.count('Từ công ty bạn theo dõi: Followed Company'), 2)
        self.assertEqual(
            CandidateJobEmailSuppression.objects.filter(candidate=self.candidate).count(),
            2,
        )

    def test_selection_query_count_is_flat_across_followed_companies_and_jobs(self):
        self._follow()
        self._job('Single company role')
        self._due_schedule()

        busy = User.objects.create_user(
            email='digest-busy-follower@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self._follow(candidate=busy)
        self._job('Shared company second role', minutes_old=6)
        for index in range(3):
            employer, company = self._employer_company(f'Extra Followed {index}')
            self._follow(candidate=busy, company=company)
            for offset in range(2):
                self._job(
                    f'Extra role {index}-{offset}',
                    minutes_old=10 + index + offset,
                    employer=employer,
                    company=company,
                )
        self._due_schedule(busy)

        with CaptureQueriesContext(connection) as due_queries:
            self.assertEqual(due_candidate_ids(self.now), [self.candidate.pk, busy.pk])
        self.assertEqual(len(due_queries), 1)

        with CaptureQueriesContext(connection) as single_queries:
            single = prepare_candidate_job_digest(self.candidate.pk, self.now)
        with CaptureQueriesContext(connection) as busy_queries:
            many = prepare_candidate_job_digest(busy.pk, self.now)

        self.assertEqual(single.job_count, 2)
        self.assertEqual(many.job_count, 8)
        self.assertEqual(len(busy_queries), len(single_queries))
