"""Trần chung cho /api/public/* (khách chưa đăng nhập, theo IP)."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from common.api.throttling import PublicApiAnonRateThrottle

CATALOG = '/api/public/jobs/languages/'


@patch.object(PublicApiAnonRateThrottle, 'rate', '2/min', create=True)
class PublicApiAnonRateThrottleTests(APITestCase):
    def test_anonymous_visitors_share_one_bucket_per_ip_across_public_endpoints(self):
        self.assertEqual(self.client.get(CATALOG).status_code, 200)
        self.assertEqual(self.client.get('/api/public/jobs/benefits/').status_code, 200)

        self.assertEqual(self.client.get(CATALOG).status_code, 429)
        other_ip = self.client.get(CATALOG, REMOTE_ADDR='203.0.113.9')
        self.assertEqual(other_ip.status_code, 200)

    def test_signed_in_users_and_other_portals_are_not_counted(self):
        user = get_user_model().objects.create_user(
            email='throttle-candidate@example.com', password='Password@123', role='candidate'
        )
        self.client.force_authenticate(user)
        for _ in range(3):
            self.assertEqual(self.client.get(CATALOG).status_code, 200)

        throttle = PublicApiAnonRateThrottle()
        request = type('Request', (), {'path': '/api/candidate/profile/'})()
        self.assertIsNone(throttle.get_cache_key(request, view=None))

    def test_views_with_their_own_throttle_keep_it(self):
        # job-stats khai ClientIPScopedRateThrottle nên không tính vào trần chung.
        for _ in range(3):
            self.assertEqual(self.client.get('/api/public/jobs/stats/').status_code, 200)
