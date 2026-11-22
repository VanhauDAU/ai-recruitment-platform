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
        with self.assertLogs('product.metrics', level='INFO') as metric_logs:
            first_notice, first_activity = self.emit()
            second_notice, second_activity = self.emit()

        self.assertEqual(first_notice.pk, second_notice.pk)
        self.assertEqual(first_activity.pk, second_activity.pk)
        self.assertEqual(EmployerNotification.objects.count(), 1)
        self.assertEqual(EmployerActivity.objects.count(), 1)
        self.assertEqual(first_notice.metadata, {'case_public_id': 'evc_approved'})
        self.assertNotIn('sha256', str(first_activity.metadata))
        self.assertTrue(first_notice.action_path.startswith('/tuyendung/app/'))
        rendered_metrics = '\n'.join(metric_logs.output)
        self.assertIn('product_metric', rendered_metrics)
        self.assertNotIn('must-not-leak', rendered_metrics)
        self.assertNotIn('private/', rendered_metrics)

    def test_activity_history_filters_by_category_and_period_with_tab_counts(self):
        self.emit(dedupe_key='case:1:approved')
        _, application = emit_employer_event(
            recipient=self.employer,
            event_type=EmployerNotification.EventType.APPLICATION_RECEIVED,
            dedupe_key='application:1',
            action_path='/tuyendung/app/applications?application=app_1',
        )
        _, old = emit_employer_event(
            recipient=self.employer,
            event_type=EmployerNotification.EventType.CAMPAIGN_HEALTH_ALERT,
            dedupe_key='campaign:1:health',
        )
        EmployerActivity.objects.filter(pk=old.pk).update(
            occurred_at=timezone.now() - timedelta(days=40)
        )
        url = reverse('employer-activity-list')

        everything = self.client.get(url)
        applications = self.client.get(url, {'category': 'applications'})
        recent = self.client.get(url, {'days': 30})

        self.assertEqual(everything.status_code, status.HTTP_200_OK)
        self.assertEqual(
            everything.data['category_counts'],
            {'all': 3, 'applications': 1, 'jobs': 0, 'campaigns': 1, 'company': 1},
        )
        [row] = applications.data['results']
        self.assertEqual(row['public_id'], application.public_id)
        self.assertEqual(row['category'], 'applications')
        self.assertEqual(row['actor_kind'], 'system')
        self.assertEqual(row['action_path'], '/tuyendung/app/applications?application=app_1')
        self.assertEqual(recent.data['category_counts']['all'], 2)
        self.assertEqual(
            {item['category'] for item in recent.data['results']}, {'applications', 'company'}
        )
        company = self.client.get(url, {'category': 'company', 'days': 'bogus'})
        self.assertEqual([item['category'] for item in company.data['results']], ['company'])

    def test_notification_list_filters_category_and_unread_with_unread_counts(self):
        read_notice, _ = self.emit(dedupe_key='case:1:approved')
        self.emit(dedupe_key='case:2:approved')
        application, _ = emit_employer_event(
            recipient=self.employer,
            event_type=EmployerNotification.EventType.APPLICATION_RECEIVED,
            dedupe_key='application:1',
        )
        self.client.post(
            reverse('employer-notification-read', kwargs={'public_id': read_notice.public_id})
        )
        url = reverse('employer-notification-list')

        company_unread = self.client.get(url, {'category': 'company', 'unread': 'true'})
        applications = self.client.get(url, {'category': 'applications'})

        self.assertEqual(company_unread.status_code, status.HTTP_200_OK)
        self.assertEqual(len(company_unread.data['results']), 1)
        self.assertEqual(company_unread.data['results'][0]['category'], 'company')
        self.assertEqual(
            company_unread.data['unread_counts'],
            {'all': 2, 'applications': 1, 'jobs': 0, 'campaigns': 0, 'company': 1},
        )
        self.assertEqual(
            [item['public_id'] for item in applications.data['results']], [application.public_id]
        )

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
                'new_application_email': True,
                'campaign_weekly_report_email': True,
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
        # A partial PATCH leaves the other switch untouched.
        self.assertEqual(updated.data['new_application_email'], True)
        self.assertEqual(updated.data['campaign_weekly_report_email'], True)

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
