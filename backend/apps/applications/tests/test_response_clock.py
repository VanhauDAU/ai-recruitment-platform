"""What the candidate may learn, and one clock for "no answer yet".

The candidate only ever sees decisions they were told about; the automatic
rejection counts from the submission, never from the last status change.
"""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.candidates.models import CandidateNotification
from apps.jobs.models import Job
from apps.jobs.tests.helpers import open_visibility_window

from ..models import Application
from ..services import (
    change_application_status,
    mark_application_viewed,
    undo_latest_status_change,
    withdraw_application,
)
from ..services.automatic_rejection import reject_due_applications
from ..services.status import AUTO_REJECTION_MIN_NOTICE
from .test_services import create_status_application

Status = Application.Status


class CandidateVisibleStatusTests(TestCase):
    def setUp(self):
        self.candidate, self.employer, self.application = create_status_application('clock')
        Job.objects.filter(pk=self.application.job_id).update(
            status=Job.Status.ACTIVE, auto_reject_after_days=21, **open_visibility_window()
        )
        self.client = APIClient()
        self.client.force_authenticate(self.candidate)

    def reload(self):
        return Application.objects.select_related('job').get(pk=self.application.pk)

    def listed(self):
        return self.client.get(reverse('candidate-application-list-create')).data['results'][0]

    def test_buttons_do_not_reveal_a_rejection_still_inside_its_undo_window(self):
        change_application_status(self.reload(), changed_by=self.employer, status=Status.REJECTED)

        row = self.listed()

        self.assertEqual(row['status'], Status.SUBMITTED)
        self.assertTrue(row['actions']['withdraw'])
        self.assertFalse(row['actions']['reapply'])

    def test_withdrawing_inside_the_undo_window_cancels_the_unannounced_decision(self):
        change_application_status(self.reload(), changed_by=self.employer, status=Status.REJECTED)

        withdrawn = withdraw_application(
            candidate=self.candidate, public_id=self.application.public_id
        )

        self.assertEqual(withdrawn.status, Status.WITHDRAWN)
        self.assertIsNone(withdrawn.rejected_at)
        rejection = withdrawn.status_history.get(to_status=Status.REJECTED)
        self.assertIsNotNone(rejection.reverted_at)
        self.assertEqual(
            withdrawn.status_history.get(to_status=Status.WITHDRAWN).from_status, Status.SUBMITTED
        )
        self.assertTrue(
            CandidateNotification.objects.filter(
                recipient=self.candidate,
                dedupe_key=rejection.notification_key,
                cancelled_at__isnull=False,
            ).exists()
        )

    def test_a_job_that_stopped_still_lets_the_candidate_withdraw(self):
        Job.objects.filter(pk=self.application.job_id).update(
            status=Job.Status.CLOSED, closed_at=timezone.now()
        )

        withdrawn = withdraw_application(
            candidate=self.candidate, public_id=self.application.public_id
        )

        self.assertEqual(withdrawn.status, Status.WITHDRAWN)

    def test_opening_the_cv_does_not_restart_the_automatic_rejection(self):
        Application.objects.filter(pk=self.application.pk).update(
            applied_at=timezone.now() - timedelta(days=22)
        )
        mark_application_viewed(self.reload(), changed_by=self.employer)

        reject_due_applications()

        self.assertEqual(self.reload().status, Status.REJECTED)

    def test_an_undo_near_the_deadline_leaves_a_warned_window(self):
        Application.objects.filter(pk=self.application.pk).update(
            applied_at=timezone.now() - timedelta(days=22)
        )
        application, _ = change_application_status(
            self.reload(), changed_by=self.employer, status=Status.SHORTLISTED
        )

        undo_latest_status_change(application, changed_by=self.employer)
        reject_due_applications()

        application = self.reload()
        self.assertEqual(application.status, Status.SUBMITTED)
        self.assertGreaterEqual(
            application.auto_reject_due_at,
            timezone.now() + AUTO_REJECTION_MIN_NOTICE - timedelta(minutes=1),
        )
        self.assertIsNone(application.auto_rejection_reminder_sent_at)
