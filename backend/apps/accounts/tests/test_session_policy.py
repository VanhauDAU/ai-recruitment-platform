"""Hạn phiên theo cổng (NIST SP 800-63B-4): access, không hoạt động, tối đa."""

from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from ..models import AuthSession, User
from ..services.refresh_cookies import cookie_name
from ..services.tokens import issue_tokens
from .factories import refresh_session, set_refresh_cookie

HOUR = 60 * 60


class PortalSessionPolicyTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _user(self, role):
        return User.objects.create_user(
            email=f'{role}-policy@example.com', password='Password@123', role=role
        )

    def _login(self, role, portal):
        user = self._user(role)
        tokens = issue_tokens(user)
        set_refresh_cookie(self.client, portal, tokens['refresh'])
        return user, tokens, AuthSession.objects.get(user=user)

    def test_each_portal_gets_its_own_access_and_absolute_lifetime(self):
        cases = [
            (User.Role.CANDIDATE, 15 * 60, 30 * 24 * HOUR),
            (User.Role.EMPLOYER, 15 * 60, 24 * HOUR),
            (User.Role.ADMIN, 5 * 60, 12 * HOUR),
        ]
        for role, access_seconds, max_age_seconds in cases:
            with self.subTest(role=role):
                user = self._user(role)
                tokens = issue_tokens(user)
                access = AccessToken(tokens['access'])
                refresh = RefreshToken(tokens['refresh'])
                session = AuthSession.objects.get(user=user)

                self.assertEqual(access['exp'] - access['iat'], access_seconds)
                self.assertEqual(refresh['exp'], int(session.expires_at.timestamp()))
                self.assertAlmostEqual(
                    (session.expires_at - session.created_at).total_seconds(),
                    max_age_seconds,
                    delta=5,
                )

    def test_refresh_after_the_idle_timeout_ends_the_session(self):
        _, _, session = self._login(User.Role.EMPLOYER, 'employer')
        AuthSession.objects.filter(pk=session.pk).update(
            last_seen_at=timezone.now() - timedelta(minutes=61)
        )

        response = refresh_session(self.client, 'employer')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        session.refresh_from_db()
        self.assertIsNotNone(session.revoked_at)

    def test_refresh_inside_the_idle_window_never_extends_the_absolute_deadline(self):
        _, _, session = self._login(User.Role.EMPLOYER, 'employer')
        AuthSession.objects.filter(pk=session.pk).update(
            last_seen_at=timezone.now() - timedelta(minutes=59)
        )

        response = refresh_session(self.client, 'employer')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        rotated = RefreshToken(response.cookies[cookie_name('employer')].value)
        self.assertEqual(rotated['exp'], int(session.expires_at.timestamp()))
        self.assertLessEqual(int(response.cookies[cookie_name('employer')]['max-age']), 24 * HOUR)
        access = AccessToken(response.data['access'])
        self.assertEqual(access['exp'] - access['iat'], 15 * 60)

    @override_settings(
        AUTH_SESSION_POLICIES={
            'candidate': {'access_minutes': 15, 'idle_minutes': 0, 'max_age_hours': 720},
            'employer': {'access_minutes': 15, 'idle_minutes': 60, 'max_age_hours': 24},
            'admin': {'access_minutes': 5, 'idle_minutes': 15, 'max_age_hours': 12},
        }
    )
    def test_zero_idle_minutes_disables_the_idle_timeout(self):
        _, _, session = self._login(User.Role.CANDIDATE, 'main')
        AuthSession.objects.filter(pk=session.pk).update(
            last_seen_at=timezone.now() - timedelta(days=20)
        )

        self.assertEqual(refresh_session(self.client, 'main').status_code, status.HTTP_200_OK)

    def test_candidate_session_survives_a_long_break_within_seven_days(self):
        _, _, session = self._login(User.Role.CANDIDATE, 'main')
        AuthSession.objects.filter(pk=session.pk).update(
            last_seen_at=timezone.now() - timedelta(days=6)
        )

        self.assertEqual(refresh_session(self.client, 'main').status_code, status.HTTP_200_OK)
