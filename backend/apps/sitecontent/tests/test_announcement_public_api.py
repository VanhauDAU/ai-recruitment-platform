from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import AnnouncementRevision
from ..services import create_announcement, publish_announcement
from .announcement_helpers import revision_payload


class ActiveAnnouncementApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-feed-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.url = reverse('site-announcements-active')

    def publish(self, *, internal_name, **overrides):
        announcement = create_announcement(
            actor=self.admin,
            internal_name=internal_name,
            revision_data=revision_payload(**overrides),
        )
        return publish_announcement(
            announcement=announcement,
            actor=self.admin,
            revision_number=1,
            expected_revision_token=1,
        )

    def test_highest_tier_wins_and_equal_tier_is_deterministically_ordered(self):
        self.publish(internal_name='Thông tin', priority=999)
        lower = self.publish(
            internal_name='Bảo mật ưu tiên thấp hơn trong cùng tier',
            kind=AnnouncementRevision.Kind.SECURITY,
            priority=10,
            message_vi='Xác thực email ngay.',
        )
        higher = self.publish(
            internal_name='Bảo mật ưu tiên cao hơn',
            kind=AnnouncementRevision.Kind.SECURITY,
            priority=20,
            message_vi='Kiểm tra phiên đăng nhập.',
        )

        response = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/', 'locale': 'vi'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item['public_id'] for item in response.data['items']],
            [higher.public_id, lower.public_id],
        )
        self.assertTrue(all(item['priority_tier'] == 2 for item in response.data['items']))
        self.assertEqual(response['Cache-Control'], 'private, no-store')

    def test_locale_fallback_cta_safety_and_next_transition(self):
        announcement = self.publish(
            internal_name='Fallback',
            message_en='',
            badge_en='',
            cta_label_en='',
            cta_url='https://example.com/jobs',
        )

        response = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/viec-lam', 'locale': 'en-US'},
        )

        item = response.data['items'][0]
        self.assertEqual(item['public_id'], announcement.public_id)
        self.assertEqual(item['message'], 'Khám phá cơ hội việc làm mới.')
        self.assertEqual(item['badge'], 'Mới')
        self.assertEqual(item['cta']['label'], 'Xem ngay')
        self.assertTrue(item['cta']['external'])
        self.assertIsNotNone(response.data['next_transition_at'])

    def test_path_boundary_and_exclusion_are_enforced(self):
        self.publish(
            internal_name='Route targeting',
            include_path_prefixes=['/viec-lam'],
            exclude_path_prefixes=['/viec-lam/noi-bo'],
        )

        included = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/viec-lam/backend'},
        )
        boundary_miss = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/viec-lam-moi'},
        )
        excluded = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/viec-lam/noi-bo/123'},
        )

        self.assertEqual(len(included.data['items']), 1)
        self.assertEqual(boundary_miss.data['items'], [])
        self.assertEqual(excluded.data['items'], [])

    def test_scheduled_announcement_is_hidden_until_start_and_reports_boundary(self):
        starts_at = timezone.now() + timedelta(hours=2)
        self.publish(
            internal_name='Scheduled',
            starts_at=starts_at.isoformat(),
            ends_at=(starts_at + timedelta(days=1)).isoformat(),
        )

        response = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/'},
        )

        self.assertEqual(response.data['items'], [])
        self.assertEqual(response.data['next_transition_at'], starts_at)

    def test_workspace_surfaces_fail_closed_for_wrong_session_role(self):
        self.publish(
            internal_name='Employer workspace',
            surfaces=[AnnouncementRevision.Surface.EMPLOYER_WORKSPACE],
            auth_audiences=[AnnouncementRevision.Audience.AUTHENTICATED],
            roles=[User.Role.EMPLOYER],
        )
        guest = self.client.get(
            self.url,
            {'surface': 'employer_workspace', 'path': '/nha-tuyen-dung'},
        )
        candidate = User.objects.create_user(
            email='announcement-wrong-role@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        self.client.force_authenticate(candidate)
        wrong_role = self.client.get(
            self.url,
            {'surface': 'employer_workspace', 'path': '/nha-tuyen-dung'},
        )
        employer = User.objects.create_user(
            email='announcement-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(employer)
        allowed = self.client.get(
            self.url,
            {'surface': 'employer_workspace', 'path': '/nha-tuyen-dung'},
        )

        self.assertEqual(guest.data['items'], [])
        self.assertEqual(wrong_role.data['items'], [])
        self.assertEqual(len(allowed.data['items']), 1)

    def test_invalid_surface_and_protocol_relative_path_are_rejected(self):
        invalid_surface = self.client.get(
            self.url,
            {'surface': 'unknown', 'path': '/'},
        )
        invalid_path = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '//evil.example'},
        )

        self.assertEqual(invalid_surface.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_path.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(
        ANNOUNCEMENT_REMOTE_ENABLED_SURFACES=('employer_marketing',),
    )
    @patch('apps.sitecontent.api.views.announcements.record_metric')
    def test_runtime_kill_switch_is_per_surface_and_fail_closed(self, record_metric):
        self.publish(
            internal_name='Candidate disabled',
            surfaces=[AnnouncementRevision.Surface.CANDIDATE],
        )
        marketing = self.publish(
            internal_name='Employer marketing enabled',
            surfaces=[AnnouncementRevision.Surface.EMPLOYER_MARKETING],
        )

        disabled = self.client.get(
            self.url,
            {'surface': 'candidate', 'path': '/'},
        )
        enabled = self.client.get(
            self.url,
            {'surface': 'employer_marketing', 'path': '/tuyendung'},
        )

        self.assertFalse(disabled.data['remote_enabled'])
        self.assertEqual(disabled.data['items'], [])
        self.assertTrue(enabled.data['remote_enabled'])
        self.assertEqual(enabled.data['items'][0]['public_id'], marketing.public_id)
        self.assertTrue(
            any(
                call.args[0] == 'announcement_feed_latency_ms'
                and call.kwargs == {'surface': 'candidate', 'status': 'disabled'}
                for call in record_metric.call_args_list
            )
        )

    @patch('apps.sitecontent.api.views.announcements.record_metric')
    @patch(
        'apps.sitecontent.api.views.announcements.active_announcements_for_request',
        side_effect=RuntimeError('injected feed failure'),
    )
    def test_feed_failure_records_operational_metric_and_propagates(
        self,
        _active_feed,
        record_metric,
    ):
        with self.assertRaises(RuntimeError):
            self.client.get(
                self.url,
                {'surface': 'candidate', 'path': '/'},
            )

        self.assertTrue(
            any(
                call.args[0] == 'announcement_feed_latency_ms'
                and call.kwargs == {'surface': 'candidate', 'status': 'error'}
                for call in record_metric.call_args_list
            )
        )


class AnnouncementRuntimeEventApiTests(APITestCase):
    @patch('apps.sitecontent.api.views.announcements.record_metric')
    def test_runtime_event_is_pii_free_and_best_effort(self, record_metric):
        response = self.client.post(
            reverse('site-announcement-runtime-events'),
            {
                'surface': 'candidate',
                'event': 'render_error',
                'reason': 'render',
                'message': 'must not be logged',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data, {'accepted': True})
        record_metric.assert_called_once_with(
            'announcement_runtime',
            event='render_error',
            reason='render',
            surface='candidate',
        )

    def test_runtime_event_throttle_fails_open_when_cache_is_unavailable(self):
        with (
            self.assertLogs('product.metrics', level='INFO') as metric_logs,
            patch(
                'rest_framework.throttling.ScopedRateThrottle.allow_request',
                side_effect=ConnectionError('redis unavailable'),
            ),
        ):
            response = self.client.post(
                reverse('site-announcement-runtime-events'),
                {
                    'surface': 'candidate',
                    'event': 'feed_error',
                    'reason': 'network',
                },
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(
            any(
                record.metric_name == 'announcement_throttle'
                and record.metric_tags
                == {
                    'event': 'fail_open',
                    'reason': 'cache_error',
                    'scope': 'announcement_runtime',
                }
                for record in metric_logs.records
            )
        )
