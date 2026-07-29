from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from apps.accounts.models import User

from ..models import (
    AnnouncementDailyMetric,
    AnnouncementRevision,
    AnnouncementUserState,
)
from ..services import (
    create_announcement,
    publish_announcement,
    record_consented_announcement_events,
)
from .announcement_helpers import create_admin_with_permissions, revision_payload


class AnnouncementStateApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-state-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.user = User.objects.create_user(
            email='announcement-state-user@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )

    def publish(self, **overrides):
        announcement = create_announcement(
            actor=self.admin,
            internal_name='State API',
            revision_data=revision_payload(**overrides),
        )
        return publish_announcement(
            announcement=announcement,
            actor=self.admin,
            revision_number=1,
            expected_revision_token=1,
        )

    def test_dismiss_is_authenticated_idempotent_and_filters_feed(self):
        announcement = self.publish()
        url = reverse(
            'site-announcement-state',
            kwargs={'public_id': announcement.public_id},
        )
        payload = {'revision': 1, 'dismissal_version': 1, 'action': 'dismiss'}

        guest = self.client.put(url, payload, format='json')
        self.client.force_authenticate(self.user)
        first = self.client.put(url, payload, format='json')
        repeated = self.client.put(url, payload, format='json')
        feed = self.client.get(
            reverse('site-announcements-active'),
            {'surface': 'candidate', 'path': '/'},
        )

        self.assertEqual(guest.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(repeated.data['dismissed_at'], first.data['dismissed_at'])
        self.assertEqual(feed.data['items'], [])
        self.assertEqual(
            AnnouncementUserState.objects.filter(
                user=self.user,
                announcement=announcement,
            ).count(),
            1,
        )

    def test_snooze_is_idempotent_and_expired_state_returns_to_feed(self):
        announcement = self.publish(
            dismiss_mode=AnnouncementRevision.DismissMode.SNOOZE,
            snooze_seconds=3600,
        )
        url = reverse(
            'site-announcement-state',
            kwargs={'public_id': announcement.public_id},
        )
        payload = {'revision': 1, 'dismissal_version': 1, 'action': 'snooze'}
        self.client.force_authenticate(self.user)

        first = self.client.put(url, payload, format='json')
        repeated = self.client.put(url, payload, format='json')
        state = AnnouncementUserState.objects.get(user=self.user, announcement=announcement)
        state.snoozed_until = timezone.now() - timedelta(seconds=1)
        state.save(update_fields=['snoozed_until'])
        visible = self.client.get(
            reverse('site-announcements-active'),
            {'surface': 'candidate', 'path': '/'},
        )

        self.assertEqual(first.data['snoozed_until'], repeated.data['snoozed_until'])
        self.assertEqual(len(visible.data['items']), 1)

    def test_stale_and_locked_state_actions_fail_closed(self):
        stale_announcement = self.publish()
        locked_announcement = self.publish(
            kind=AnnouncementRevision.Kind.CRITICAL,
            dismiss_mode=AnnouncementRevision.DismissMode.LOCKED,
        )
        self.client.force_authenticate(self.user)

        stale = self.client.put(
            reverse(
                'site-announcement-state',
                kwargs={'public_id': stale_announcement.public_id},
            ),
            {'revision': 9, 'dismissal_version': 1, 'action': 'dismiss'},
            format='json',
        )
        locked = self.client.put(
            reverse(
                'site-announcement-state',
                kwargs={'public_id': locked_announcement.public_id},
            ),
            {'revision': 1, 'dismissal_version': 1, 'action': 'dismiss'},
            format='json',
        )

        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(stale.data['code'], 'announcement_state_stale')
        self.assertEqual(locked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AnnouncementUserState.objects.exists())


class AnnouncementAnalyticsApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            email='announcement-analytics-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        announcement = create_announcement(
            actor=self.admin,
            internal_name='Analytics API',
            revision_data=revision_payload(),
        )
        self.announcement = publish_announcement(
            announcement=announcement,
            actor=self.admin,
            revision_number=1,
            expected_revision_token=1,
        )
        self.revision = self.announcement.active_revision
        self.url = reverse('site-announcement-events')
        self.events = {
            'events': [
                {
                    'public_id': self.announcement.public_id,
                    'revision': 1,
                    'surface': 'candidate',
                    'event': 'impression',
                },
                {
                    'public_id': self.announcement.public_id,
                    'revision': 1,
                    'surface': 'candidate',
                    'event': 'click',
                },
            ]
        }

    def grant_analytics_consent(self):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )

    def test_without_analytics_consent_accepts_without_storage_or_identifier(self):
        response = self.client.post(self.url, self.events, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data, {'accepted': True})
        self.assertFalse(AnnouncementDailyMetric.objects.exists())
        self.assertNotIn('procv_viewer_id', response.cookies)

    @patch('apps.sitecontent.services.announcements._claim_unique_event', return_value=True)
    def test_consented_batch_increments_daily_metrics_and_sets_viewer_cookie(self, _claim):
        self.grant_analytics_consent()

        response = self.client.post(self.url, self.events, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('procv_viewer_id', response.cookies)
        metric = AnnouncementDailyMetric.objects.get(
            announcement_revision=self.revision,
            surface=AnnouncementRevision.Surface.CANDIDATE,
        )
        self.assertEqual(metric.impressions, 1)
        self.assertEqual(metric.unique_impressions, 1)
        self.assertEqual(metric.clicks, 1)
        self.assertEqual(metric.unique_clicks, 1)

    @patch('apps.sitecontent.services.announcements._claim_unique_event', return_value=False)
    def test_duplicate_events_do_not_increment_metrics(self, _claim):
        self.grant_analytics_consent()

        response = self.client.post(self.url, self.events, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertFalse(AnnouncementDailyMetric.objects.exists())

    @patch('apps.sitecontent.services.announcements._claim_unique_event', return_value=None)
    def test_redis_failure_drops_metrics_without_failing_request(self, _claim):
        self.grant_analytics_consent()

        response = self.client.post(self.url, self.events, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertFalse(AnnouncementDailyMetric.objects.exists())

    @patch('apps.sitecontent.services.announcements._claim_unique_event', return_value=None)
    def test_redis_failure_in_throttle_fails_open_for_best_effort_events(self, _claim):
        self.grant_analytics_consent()

        with (
            self.assertLogs('product.metrics', level='INFO') as metric_logs,
            patch(
                'rest_framework.throttling.ScopedRateThrottle.allow_request',
                side_effect=ConnectionError('redis unavailable'),
            ),
        ):
            response = self.client.post(self.url, self.events, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data, {'accepted': True})
        self.assertFalse(AnnouncementDailyMetric.objects.exists())
        self.assertTrue(
            any(
                record.metric_name == 'announcement_throttle'
                and record.metric_tags
                == {
                    'event': 'fail_open',
                    'reason': 'cache_error',
                    'scope': 'announcement_event',
                }
                for record in metric_logs.records
            )
        )

    @patch('apps.sitecontent.services.announcements._claim_unique_event', return_value=True)
    def test_invalid_revision_or_surface_is_ignored(self, claim):
        self.grant_analytics_consent()
        payload = {
            'events': [
                {**self.events['events'][0], 'revision': 99},
                {**self.events['events'][0], 'surface': 'admin_workspace'},
            ]
        }

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        claim.assert_not_called()
        self.assertFalse(AnnouncementDailyMetric.objects.exists())

    def test_event_endpoint_has_an_independent_rate_limit(self):
        cache.clear()

        for _ in range(240):
            accepted = self.client.post(self.url, self.events, format='json')
            self.assertEqual(accepted.status_code, status.HTTP_202_ACCEPTED)
        throttled = self.client.post(self.url, self.events, format='json')

        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class AnnouncementMetricAdminApiTests(APITestCase):
    def setUp(self):
        self.viewer = create_admin_with_permissions(
            'announcement.view',
            email='announcement-metric-viewer@example.com',
        )
        announcement = create_announcement(
            actor=self.viewer,
            internal_name='Metric dashboard',
            revision_data=revision_payload(),
        )
        self.announcement = publish_announcement(
            announcement=announcement,
            actor=self.viewer,
            revision_number=1,
            expected_revision_token=1,
        )
        AnnouncementDailyMetric.objects.create(
            announcement_revision=self.announcement.active_revision,
            date=timezone.localdate(),
            surface=AnnouncementRevision.Surface.CANDIDATE,
            impressions=20,
            unique_impressions=15,
            clicks=5,
            unique_clicks=4,
            dismisses=2,
        )
        self.url = reverse(
            'site-admin-announcement-metrics',
            kwargs={'public_id': self.announcement.public_id},
        )

    def test_view_permission_reads_server_aggregate_and_rates(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary']['impressions'], 20)
        self.assertEqual(response.data['summary']['ctr'], 25.0)
        self.assertEqual(response.data['summary']['dismiss_rate'], 10.0)
        self.assertIn('Analytics', response.data['consent_notice'])

        listing = self.client.get(reverse('site-admin-announcements'))
        row = listing.data['results'][0]
        self.assertEqual(row['impressions'], 20)
        self.assertEqual(row['clicks'], 5)
        self.assertEqual(row['ctr'], 25.0)
        self.assertEqual(row['dismisses'], 2)

    def test_metrics_permission_and_date_range_fail_closed(self):
        outsider = User.objects.create_user(
            email='announcement-metric-outsider@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(outsider)
        denied = self.client.get(self.url)
        self.client.force_authenticate(self.viewer)
        invalid_range = self.client.get(
            self.url,
            {'date_from': '2026-01-01', 'date_to': '2026-05-01'},
        )

        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(invalid_range.status_code, status.HTTP_400_BAD_REQUEST)


class AnnouncementMetricConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        admin = User.objects.create_user(
            email='announcement-concurrency-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        announcement = create_announcement(
            actor=admin,
            internal_name='Concurrent metric',
            revision_data=revision_payload(),
        )
        announcement = publish_announcement(
            announcement=announcement,
            actor=admin,
            revision_number=1,
            expected_revision_token=1,
        )
        self.revision_id = announcement.active_revision_id

    @patch('apps.sitecontent.services.announcements._claim_unique_event', return_value=True)
    def test_concurrent_first_writes_preserve_both_increments(self, _claim):
        def record():
            close_old_connections()
            try:
                revision = AnnouncementRevision.objects.get(pk=self.revision_id)
                request = APIRequestFactory().post('/api/site/announcements/events/')
                request.user = AnonymousUser()
                record_consented_announcement_events(
                    request,
                    [
                        {
                            'revision_object': revision,
                            'surface': AnnouncementRevision.Surface.CANDIDATE,
                            'event': 'impression',
                        }
                    ],
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: record(), range(2)))

        metric = AnnouncementDailyMetric.objects.get(
            announcement_revision_id=self.revision_id,
            surface=AnnouncementRevision.Surface.CANDIDATE,
        )
        self.assertEqual(metric.impressions, 2)
        self.assertEqual(metric.unique_impressions, 2)
