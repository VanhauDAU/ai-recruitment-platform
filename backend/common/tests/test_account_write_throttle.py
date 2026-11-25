"""Hành vi trần ghi theo tài khoản và scope ghi rủi ro cao (ADR-0031)."""

from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, APITestCase, force_authenticate
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from common.api.throttling import (
    ACCOUNT_WRITE_THROTTLES,
    PublicApiAnonRateThrottle,
    WriteScopedRateThrottle,
    with_account_write_cap,
    with_default_throttles,
)

RATES = {
    'account_write_burst': '2/min',
    'account_write_sustained': '100/hour',
    'account_write_burst_admin': '5/min',
    'account_write_sustained_admin': '100/hour',
    'test_risky_write': '1/hour',
    'test_own_scope': '100/hour',
}


class _EchoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'ok': True})

    def post(self, request):
        return Response({'ok': True})

    def put(self, request):
        return Response({'ok': True})


class CappedView(_EchoView):
    """View không tự khai throttle: nhận DEFAULT_THROTTLE_CLASSES của dự án."""


class OwnThrottleView(_EchoView):
    throttle_classes = with_account_write_cap(ScopedRateThrottle)
    throttle_scope = 'test_own_scope'


class RiskyWriteView(_EchoView):
    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'test_risky_write'
    throttle_scope_methods = ('POST',)


@patch.dict(SimpleRateThrottle.THROTTLE_RATES, RATES)
class AccountWriteThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        User = get_user_model()
        self.candidate = User.objects.create_user(
            email='write-cap-a@example.com', password='Password@123', role='candidate'
        )
        self.other = User.objects.create_user(
            email='write-cap-b@example.com', password='Password@123', role='employer'
        )
        self.admin = User.objects.create_user(
            email='write-cap-admin@example.com', password='Password@123', role='admin'
        )

    def _call(self, view, method='post', user=None, **extra):
        request = getattr(self.factory, method)('/api/candidate/test/', **extra)
        if user is not None:
            force_authenticate(request, user=user)
        return view.as_view()(request).status_code

    def test_the_project_default_includes_the_cap(self):
        self.assertEqual(
            settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'],
            (
                'common.api.throttling.PublicApiAnonRateThrottle',
                'common.api.throttling.AccountWriteBurstThrottle',
                'common.api.throttling.AccountWriteSustainedThrottle',
            ),
        )
        self.assertEqual(
            with_default_throttles(WriteScopedRateThrottle),
            [PublicApiAnonRateThrottle, *ACCOUNT_WRITE_THROTTLES, WriteScopedRateThrottle],
        )

    def test_writes_over_the_cap_are_rejected_per_account(self):
        self.assertEqual(self._call(CappedView, user=self.candidate), 200)
        self.assertEqual(self._call(CappedView, 'put', user=self.candidate), 200)

        self.assertEqual(self._call(CappedView, user=self.candidate), 429)
        # Bucket theo tài khoản, không theo IP: người khác cùng văn phòng vẫn ghi được.
        self.assertEqual(self._call(CappedView, user=self.other), 200)

    def test_reads_and_anonymous_visitors_are_not_counted(self):
        for _ in range(5):
            self.assertEqual(self._call(CappedView, 'get', user=self.candidate), 200)
            self.assertEqual(self._call(CappedView), 200)

        self.assertEqual(self._call(CappedView, user=self.candidate), 200)

    def test_admins_use_the_wider_admin_scope(self):
        for _ in range(5):
            self.assertEqual(self._call(CappedView, user=self.admin), 200)

        self.assertEqual(self._call(CappedView, user=self.admin), 429)

    def test_the_sustained_bucket_is_enforced_independently(self):
        rates = {'account_write_burst': '100/min', 'account_write_sustained': '1/hour'}
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, rates):
            self.assertEqual(self._call(CappedView, user=self.candidate), 200)
            self.assertEqual(self._call(CappedView, user=self.candidate), 429)

    def test_a_rejected_write_logs_scope_and_account_without_pii(self):
        self._call(CappedView, user=self.candidate)
        self._call(CappedView, user=self.candidate)

        with self.assertLogs('common.api.throttling', 'WARNING') as logs:
            self.assertEqual(self._call(CappedView, user=self.candidate), 429)

        self.assertIn('scope=account_write_burst', logs.output[0])
        self.assertIn(f'user={self.candidate.pk}', logs.output[0])
        self.assertNotIn(self.candidate.email, logs.output[0])

    def test_views_with_their_own_throttle_keep_the_cap(self):
        self.assertEqual(self._call(OwnThrottleView, user=self.candidate), 200)
        self.assertEqual(self._call(OwnThrottleView, user=self.candidate), 200)

        self.assertEqual(self._call(OwnThrottleView, user=self.candidate), 429)


# Trần chung nới rộng để mọi 429 ở đây đến từ scope riêng.
@patch.dict(SimpleRateThrottle.THROTTLE_RATES, {**RATES, 'account_write_burst': '100/min'})
class WriteScopedRateThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            email='risky-write@example.com', password='Password@123', role='employer'
        )

    def _call(self, method='post', user=None, ip='198.51.100.7'):
        request = getattr(self.factory, method)('/api/employer/test/', REMOTE_ADDR=ip)
        if user is not None:
            force_authenticate(request, user=user)
        return RiskyWriteView.as_view()(request).status_code

    def test_only_listed_write_methods_spend_the_scope(self):
        self.assertEqual(self._call('get', user=self.user), 200)
        self.assertEqual(self._call('put', user=self.user), 200)
        self.assertEqual(self._call(user=self.user), 200)

        self.assertEqual(self._call(user=self.user), 429)
        self.assertEqual(self._call('get', user=self.user), 200)

    def test_anonymous_writes_are_keyed_by_client_ip(self):
        self.assertEqual(self._call(), 200)
        self.assertEqual(self._call(), 429)

        self.assertEqual(self._call(ip='203.0.113.9'), 200)
