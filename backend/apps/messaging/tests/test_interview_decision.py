"""Sau phỏng vấn: nhắc NTD ra kết quả, ứng viên được nhắc; không tự từ chối."""

from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.applications.models import Application, ApplicationReminder, ApplicationStatusHistory
from apps.applications.services import (
    candidate_reminder_available_at,
    record_interview_end,
    send_interview_decision_reminders,
)
from apps.employers.models import EmployerNotification

from .factories import ConnectFixture


class InterviewDecisionReminderTests(ConnectFixture, APITestCase):
    def setUp(self):
        super().setUp()
        Application.objects.filter(pk=self.application.pk).update(
            status=Application.Status.INTERVIEWED, interviewed_at=timezone.now()
        )
        # Quyết định đã công bố (không còn thông báo chờ): ứng viên thấy "Phỏng vấn".
        ApplicationStatusHistory.objects.create(
            application=self.application, from_status='submitted', to_status='interviewed'
        )
        self.application.refresh_from_db()

    def awaiting(self):
        return EmployerNotification.objects.get(
            recipient=self.recruiter, event_type='application_awaiting_reply'
        )

    def test_recruiter_is_reminded_once_after_the_interview_ended(self):
        ended = timezone.now() - timedelta(days=4)
        record_interview_end(self.application.pk, ended)

        with patch('apps.applications.tasks.send_interview_decision_email.delay') as email:
            with self.captureOnCommitCallbacks(execute=True):
                first = send_interview_decision_reminders()
            again = send_interview_decision_reminders()

        self.assertEqual((first, again), (1, 0))
        self.assertIn('kết quả phỏng vấn', self.awaiting().message)
        email.assert_called_once_with(self.job.pk, [self.application.pk])

    def test_no_reminder_before_the_delay_or_after_a_decision(self):
        record_interview_end(self.application.pk, timezone.now() - timedelta(days=1))
        self.assertEqual(send_interview_decision_reminders(), 0)

        record_interview_end(self.application.pk, timezone.now() - timedelta(days=5))
        Application.objects.filter(pk=self.application.pk).update(status='accepted')
        self.assertEqual(send_interview_decision_reminders(), 0)

    def test_without_a_schedule_the_invitation_time_is_the_anchor(self):
        Application.objects.filter(pk=self.application.pk).update(
            interviewed_at=timezone.now() - timedelta(days=4)
        )

        self.assertEqual(send_interview_decision_reminders(now=timezone.now()), 1)

    def test_candidate_may_remind_after_the_delay(self):
        ended = timezone.now() - timedelta(days=4)
        record_interview_end(self.application.pk, ended)
        self.application.refresh_from_db()

        available = candidate_reminder_available_at(
            self.application, visible_status=Application.Status.INTERVIEWED
        )
        self.login(self.candidate)
        response = self.client.post(
            reverse('candidate-application-remind', args=[self.application.public_id])
        )

        self.assertEqual(available, ended + timedelta(days=3))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(
            ApplicationReminder.objects.filter(
                application=self.application, source=ApplicationReminder.Source.CANDIDATE
            ).exists()
        )
        self.assertIn('kết quả phỏng vấn', self.awaiting().message)
