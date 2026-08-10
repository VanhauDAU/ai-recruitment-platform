from datetime import timedelta

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import EmployerActivity, EmployerNotification
from ..services import emit_employer_event
from ..tasks.notifications import purge_expired_employer_event_history


class EmployerNotificationApiTests(APITestCase):
    def setUp(self):
        self.employer = User.objects.create_user(
            email='notification-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.other_employer = User.objects.create_user(
            email='notification-other@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(self.employer)

    def emit(self, *, recipient=None, dedupe_key='case:1:approved'):
        return emit_employer_event(
            recipient=recipient or self.employer,
            event_type=EmployerNotification.EventType.VERIFICATION_APPROVED,
            dedupe_key=dedupe_key,
            message='Hồ sơ đã đủ điều kiện.',
            subject_public_id='evc_approved',
            metadata={
                'case_public_id': 'evc_approved',
                'sha256': 'must-not-leak',
                'file_url': 'private/must-not-leak.pdf',
            },
        )

    def test_emit_is_idempotent_and_redacts_unknown_metadata(self):
        first_notice, first_activity = self.emit()
        second_notice, second_activity = self.emit()

        self.assertEqual(first_notice.pk, second_notice.pk)
        self.assertEqual(first_activity.pk, second_activity.pk)
        self.assertEqual(EmployerNotification.objects.count(), 1)
        self.assertEqual(EmployerActivity.objects.count(), 1)
        self.assertEqual(first_notice.metadata, {'case_public_id': 'evc_approved'})
        self.assertNotIn('sha256', str(first_activity.metadata))
        self.assertTrue(first_notice.action_path.startswith('/tuyendung/app/'))

    def test_list_unread_read_and_read_all_are_scoped_to_recipient(self):
        first_notice, _ = self.emit(dedupe_key='case:1:approved')
        self.emit(dedupe_key='case:2:approved')
        other_notice, _ = self.emit(
            recipient=self.other_employer,
            dedupe_key='case:other:approved',
        )

        listing = self.client.get(reverse('employer-notification-list'))
        unread = self.client.get(reverse('employer-notification-unread-count'))
        activity = self.client.get(reverse('employer-activity-list'))

        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data['results']), 2)
        self.assertEqual(unread.data, {'count': 2})
        self.assertEqual(len(activity.data['results']), 2)
        self.assertNotIn(other_notice.public_id, str(listing.data))

        read = self.client.post(
            reverse('employer-notification-read', kwargs={'public_id': first_notice.public_id})
        )
        self.assertEqual(read.status_code, status.HTTP_200_OK)
        self.assertTrue(read.data['is_read'])
        self.assertEqual(
            self.client.get(reverse('employer-notification-unread-count')).data,
            {'count': 1},
        )

        read_all = self.client.post(reverse('employer-notification-read-all'))
        self.assertEqual(read_all.data, {'updated': 1})
        other_notice.refresh_from_db()
        self.assertIsNone(other_notice.read_at)

    def test_cannot_mark_another_recipients_notification_as_read(self):
        other_notice, _ = self.emit(recipient=self.other_employer)

        response = self.client.post(
            reverse('employer-notification-read', kwargs={'public_id': other_notice.public_id})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other_notice.refresh_from_db()
        self.assertIsNone(other_notice.read_at)

    def test_intermediate_email_preference_is_configurable_but_important_email_is_fixed(self):
        endpoint = reverse('employer-notification-preferences')
        initial = self.client.get(endpoint)
        self.assertEqual(
            initial.data,
            {
                'important_decision_email': True,
                'intermediate_verification_email': True,
            },
        )

        updated = self.client.patch(
            endpoint,
            {'intermediate_verification_email': False},
            format='json',
        )

        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data['important_decision_email'], True)
        self.assertEqual(updated.data['intermediate_verification_email'], False)

    @override_settings(EMPLOYER_EVENT_RETENTION_DAYS=730)
    def test_retention_removes_old_website_events_and_keeps_current_events(self):
        old_notice, old_activity = self.emit(dedupe_key='old-event')
        current_notice, current_activity = self.emit(dedupe_key='current-event')
        old_time = timezone.now() - timedelta(days=731)
        EmployerNotification.objects.filter(pk=old_notice.pk).update(created_at=old_time)
        EmployerActivity.objects.filter(pk=old_activity.pk).update(occurred_at=old_time)

        result = purge_expired_employer_event_history()

        self.assertEqual(result['notifications'], 1)
        self.assertEqual(result['activities'], 1)
        self.assertTrue(EmployerNotification.objects.filter(pk=current_notice.pk).exists())
        self.assertTrue(EmployerActivity.objects.filter(pk=current_activity.pk).exists())
