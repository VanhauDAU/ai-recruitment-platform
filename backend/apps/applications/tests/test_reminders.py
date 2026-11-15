from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.employers.models import EmployerNotification
from apps.jobs.models import Job

from ..models import Application, ApplicationReminder
from ..services import (
    ApplicationNotAllowed,
    request_recruiter_reminder,
    send_unanswered_application_reminders,
)
from .test_services import create_status_application

AWAITING = EmployerNotification.EventType.APPLICATION_AWAITING_REPLY


class RecruiterReminderTests(TestCase):
    def setUp(self):
        self.candidate, self.employer, self.application = create_status_application('remind')
        Job.objects.filter(pk=self.application.job_id).update(status=Job.Status.ACTIVE)

    def age(self, days, application=None):
        application = application or self.application
        Application.objects.filter(pk=application.pk).update(
            applied_at=timezone.now() - timedelta(days=days),
            submitted_at=timezone.now() - timedelta(days=days),
        )

    def remind(self):
        return request_recruiter_reminder(
            candidate=self.candidate, public_id=self.application.public_id
        )

    def test_candidate_may_remind_twice_after_three_days_with_a_gap(self):
        with self.assertRaises(ApplicationNotAllowed):
            self.remind()
        self.age(4)
        self.remind()
        with self.assertRaises(ApplicationNotAllowed):
            self.remind()
        ApplicationReminder.objects.update(created_at=timezone.now() - timedelta(days=4))
        self.remind()
        ApplicationReminder.objects.update(created_at=timezone.now() - timedelta(days=4))
        with self.assertRaises(ApplicationNotAllowed):
            self.remind()

        self.assertEqual(
            ApplicationReminder.objects.filter(source=ApplicationReminder.Source.CANDIDATE).count(),
            2,
        )
        self.assertEqual(
            EmployerNotification.objects.filter(
                recipient=self.employer, event_type=AWAITING
            ).count(),
            2,
        )

    def test_reminders_show_in_the_candidate_timeline_with_the_remind_action(self):
        self.age(4)
        client = APIClient()
        client.force_authenticate(self.candidate)
        listed = client.get(reverse('candidate-application-list-create-v2')).data['results'][0]
        reminded = client.post(
            reverse('candidate-application-remind-v2', args=[self.application.public_id])
        )

        self.assertTrue(listed['actions']['remind'])
        self.assertEqual(reminded.status_code, 200, reminded.data)
        self.assertFalse(reminded.data['actions']['remind'])
        self.assertIsNotNone(reminded.data['actions']['remind_available_at'])
        self.assertEqual(reminded.data['timeline'][0]['status'], 'reminder')
        self.assertIn('ProCV đã nhắc', reminded.data['timeline'][0]['label'])

    def test_system_reminds_at_three_then_seven_days_once_per_job(self):
        _, _, other = create_status_application('remind-other')
        Application.objects.filter(pk=other.pk).update(job=self.application.job)
        self.age(4)
        self.age(4, other)

        first = send_unanswered_application_reminders()
        again = send_unanswered_application_reminders()
        self.age(8)
        second = send_unanswered_application_reminders()
        self.age(30)
        after_both = send_unanswered_application_reminders()

        self.assertEqual((first, again, second, after_both), (2, 0, 1, 0))
        self.assertEqual(
            EmployerNotification.objects.filter(
                recipient=self.employer, event_type=AWAITING
            ).count(),
            2,
        )

    def test_a_stopped_job_leaves_nothing_to_remind_or_withdraw(self):
        self.age(4)
        Job.objects.filter(pk=self.application.job_id).update(
            status=Job.Status.CLOSED, closed_at=timezone.now()
        )
        client = APIClient()
        client.force_authenticate(self.candidate)
        listed = client.get(reverse('candidate-application-list-create-v2')).data['results'][0]

        self.assertIsNotNone(listed['job_stopped_at'])
        self.assertFalse(listed['actions']['remind'])
        self.assertFalse(listed['actions']['withdraw'])
        with self.assertRaises(ApplicationNotAllowed):
            self.remind()

    def test_answered_application_is_never_reminded(self):
        self.age(10)
        Application.objects.filter(pk=self.application.pk).update(
            status=Application.Status.SHORTLISTED
        )

        self.assertEqual(send_unanswered_application_reminders(), 0)
        with self.assertRaises(ApplicationNotAllowed):
            self.remind()
