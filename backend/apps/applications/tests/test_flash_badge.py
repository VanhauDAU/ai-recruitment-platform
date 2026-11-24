"""Huy hiệu Sấm Chớp (ADR-0027): tự cấp, tự gỡ theo quyết định đúng hạn của người đăng tin."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.employers.models import EmployerNotification
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window
from apps.sitecontent.models import SiteSetting

from ..domain.flash_badge import parse_policy
from ..models import Application, ApplicationStatusHistory, RecruiterResponsiveness
from ..services import refresh_flash_badges
from .test_services import create_status_application

Event = EmployerNotification.EventType
SHORTLISTED = Application.Status.SHORTLISTED


class FlashBadgeTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        _, self.employer, first = create_status_application('flash-0')
        self.job = first.job
        self.company_id = self.job.company_id
        self.publish(self.job)
        self.applications = [first] + [self.add_application(index) for index in range(1, 5)]

    @staticmethod
    def publish(job):
        Job.objects.filter(pk=job.pk).update(status=Job.Status.ACTIVE, **open_visibility_window())

    def add_application(self, index, *, job=None):
        _, _, application = create_status_application(f'flash-{index}')
        Application.objects.filter(pk=application.pk).update(job=job or self.job)
        return Application.objects.get(pk=application.pk)

    def submit(self, application, *, days_ago):
        applied_at = self.now - timedelta(days=days_ago)
        Application.objects.filter(pk=application.pk).update(applied_at=applied_at)
        return applied_at

    def decide(self, application, *, days_ago=5, after_hours=24, to=SHORTLISTED, **extra):
        applied_at = self.submit(application, days_ago=days_ago)
        row = ApplicationStatusHistory.objects.create(
            application=application,
            from_status=Application.Status.SUBMITTED,
            to_status=to,
            changed_by=extra.pop('changed_by', self.employer),
        )
        ApplicationStatusHistory.objects.filter(pk=row.pk).update(
            created_at=applied_at + timedelta(hours=after_hours), **extra
        )
        Application.objects.filter(pk=application.pk).update(status=to)

    def decide_all_on_time(self):
        for application in self.applications:
            self.decide(application)

    def snapshot(self):
        return RecruiterResponsiveness.objects.get(
            company_id=self.company_id, recruiter_id=self.employer.pk
        )

    def notifications(self, event_type):
        return EmployerNotification.objects.filter(recipient=self.employer, event_type=event_type)

    def test_recruiter_deciding_on_time_earns_the_badge_on_public_jobs(self):
        self.decide_all_on_time()

        result = refresh_flash_badges(at=self.now)

        snapshot = self.snapshot()
        self.assertEqual(result['qualified'], 1)
        self.assertTrue(snapshot.qualified)
        self.assertEqual((snapshot.matured_count, snapshot.on_time_count), (5, 5))
        self.assertEqual(snapshot.response_rate, 100)
        self.assertEqual(snapshot.avg_response_hours, 24.0)
        self.assertTrue(Job.objects.get(pk=self.job.pk).has_flash_badge)
        self.assertEqual(self.notifications(Event.FLASH_BADGE_GRANTED).count(), 1)

    def test_only_recruiter_decisions_in_time_count_as_responses(self):
        first, late, automatic, viewed, undone = self.applications
        self.decide(first)
        self.decide(late, after_hours=100)
        self.decide(automatic, to=Application.Status.REJECTED, changed_by=None)
        self.decide(viewed, to=Application.Status.VIEWED)
        self.decide(undone, reverted_at=self.now - timedelta(days=4))

        refresh_flash_badges(at=self.now)

        snapshot = self.snapshot()
        self.assertEqual((snapshot.matured_count, snapshot.on_time_count), (5, 1))
        self.assertFalse(snapshot.qualified)
        self.assertFalse(Job.objects.get(pk=self.job.pk).has_flash_badge)

    def test_application_withdrawn_before_its_deadline_is_not_held_against_the_recruiter(self):
        self.decide_all_on_time()
        withdrawn = self.add_application(5)
        applied_at = self.submit(withdrawn, days_ago=5)
        Application.objects.filter(pk=withdrawn.pk).update(
            status=Application.Status.WITHDRAWN, withdrawn_at=applied_at + timedelta(hours=2)
        )

        refresh_flash_badges(at=self.now)

        self.assertEqual(self.snapshot().matured_count, 5)
        self.assertTrue(self.snapshot().qualified)

    def test_applications_still_inside_their_deadline_are_not_counted_yet(self):
        self.decide_all_on_time()
        self.submit(self.add_application(5), days_ago=1)

        refresh_flash_badges(at=self.now)

        self.assertEqual(self.snapshot().matured_count, 5)

    def test_too_few_applications_do_not_earn_the_badge(self):
        for application in self.applications[:4]:
            self.decide(application)
        Application.objects.filter(pk=self.applications[4].pk).delete()

        refresh_flash_badges(at=self.now)

        self.assertFalse(self.snapshot().qualified)

    def test_badge_is_lost_after_a_quiet_week_and_the_recruiter_is_told_why(self):
        self.decide_all_on_time()
        refresh_flash_badges(at=self.now)

        result = refresh_flash_badges(at=self.now + timedelta(days=8))

        self.assertFalse(self.snapshot().qualified)
        self.assertEqual(result['jobs_revoked'], 1)
        self.assertFalse(Job.objects.get(pk=self.job.pk).has_flash_badge)
        lost = self.notifications(Event.FLASH_BADGE_LOST).get()
        self.assertIn('7 ngày', lost.message)

    def test_job_with_an_overdue_application_loses_the_badge_but_others_keep_it(self):
        self.decide_all_on_time()
        other_job = Job.objects.get(pk=self.job.pk)
        other_job.pk = None
        other_job.public_id = ''
        other_job.code = ''
        other_job.slug = f'{self.job.slug}-other'
        other_job.save()
        self.publish(other_job)
        for index in range(5, 10):
            self.decide(self.add_application(index, job=other_job))
        self.submit(self.add_application(10, job=other_job), days_ago=4)

        refresh_flash_badges(at=self.now)

        self.assertTrue(self.snapshot().qualified)
        self.assertEqual(self.snapshot().overdue_count, 1)
        self.assertTrue(Job.objects.get(pk=self.job.pk).has_flash_badge)
        self.assertFalse(Job.objects.get(pk=other_job.pk).has_flash_badge)

    def test_switching_the_badge_off_removes_it_everywhere(self):
        self.decide_all_on_time()
        refresh_flash_badges(at=self.now)
        SiteSetting.objects.update_or_create(key='flash_badge_enabled', defaults={'value': False})

        refresh_flash_badges(at=self.now)

        self.assertFalse(self.snapshot().qualified)
        self.assertFalse(Job.objects.get(pk=self.job.pk).has_flash_badge)

    def test_notifications_are_sent_once_and_warn_before_a_deadline(self):
        self.decide_all_on_time()
        self.submit(self.add_application(5), days_ago=2.5)

        refresh_flash_badges(at=self.now)
        refresh_flash_badges(at=self.now + timedelta(minutes=5))

        self.assertEqual(self.notifications(Event.FLASH_BADGE_GRANTED).count(), 1)
        self.assertEqual(self.notifications(Event.FLASH_BADGE_AT_RISK).count(), 1)

    def test_projecting_the_badge_keeps_the_job_edit_timestamp(self):
        self.decide_all_on_time()
        updated_at = Job.objects.get(pk=self.job.pk).updated_at

        refresh_flash_badges(at=self.now)

        self.assertEqual(Job.objects.get(pk=self.job.pk).updated_at, updated_at)

    def test_dashboard_and_job_detail_show_the_real_numbers(self):
        self.decide_all_on_time()
        refresh_flash_badges(at=self.now)
        client = APIClient()
        client.force_authenticate(self.employer)

        dashboard = client.get(reverse('employer-dashboard')).data['flash_badge']
        detail = APIClient().get(reverse('job-detail', args=[self.job.slug])).data

        self.assertTrue(dashboard['qualified'])
        self.assertEqual(
            [item['code'] for item in dashboard['criteria']],
            ['enough_applications', 'response_rate', 'recent_activity', 'no_overdue'],
        )
        self.assertTrue(all(item['met'] for item in dashboard['criteria']))
        self.assertEqual(detail['flash_badge_stats']['response_rate'], 100)


class FlashBadgePolicyTests(TestCase):
    def test_out_of_range_settings_fall_back_to_safe_bounds(self):
        policy = parse_policy(
            {
                'flash_badge_enabled': 'yes',
                'flash_badge_window_days': 9999,
                'flash_badge_response_hours': 1,
                'flash_badge_min_response_rate': 'x',
            }
        )

        self.assertTrue(policy.enabled)
        self.assertEqual(policy.window, timedelta(days=180))
        self.assertEqual(policy.response_hours, 4)
        self.assertEqual(policy.min_response_rate, 80)
