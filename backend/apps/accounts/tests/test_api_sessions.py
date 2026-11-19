"""Tầng HTTP: phiên đăng nhập, refresh xoay vòng và logout."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from ..models import AuthSession, User
from ..services.refresh_cookies import cookie_name
from ..services.tokens import issue_tokens
from .factories import refresh_session, set_refresh_cookie


class SessionManagementTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='sess@example.com', password='Password@123')

    def _auth(self, tokens):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def test_issuing_tokens_creates_a_listable_current_session(self):
        self._auth(issue_tokens(self.user))

        res = self.client.get(reverse('auth-sessions'))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertTrue(res.data[0]['current'])

    def test_second_device_is_not_current_and_can_be_revoked(self):
        current = issue_tokens(self.user)
        other = issue_tokens(self.user)
        self._auth(current)

        listed = self.client.get(reverse('auth-sessions')).data
        self.assertEqual(len(listed), 2)
        other_row = next(s for s in listed if not s['current'])

        revoked = self.client.delete(reverse('auth-session-revoke', args=[other_row['id']]))
        self.assertEqual(revoked.status_code, status.HTTP_204_NO_CONTENT)

        # Refresh token của thiết bị bị thu hồi không còn dùng được.
        set_refresh_cookie(self.client, 'main', other['refresh'])
        blocked = refresh_session(self.client)
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(len(self.client.get(reverse('auth-sessions')).data), 1)

        # Access JWT của thiết bị vừa thu hồi bị chặn ngay, không chờ hết hạn.
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + other['access'])
        self.assertEqual(
            self.client.get(reverse('auth-me')).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_history_scope_also_returns_revoked_sessions(self):
        current = issue_tokens(self.user)
        issue_tokens(self.user)
        self._auth(current)
        listed = self.client.get(reverse('auth-sessions')).data
        other_row = next(s for s in listed if not s['current'])
        self.client.delete(reverse('auth-session-revoke', args=[other_row['id']]))

        # Mặc định vẫn chỉ trả phiên còn hiệu lực (hợp đồng cũ không đổi).
        self.assertEqual(len(self.client.get(reverse('auth-sessions')).data), 1)

        history = self.client.get(reverse('auth-sessions'), {'scope': 'history'}).data
        self.assertEqual(len(history), 2)
        self.assertIsNotNone(next(row for row in history if not row['current'])['revoked_at'])
        self.assertIsNone(next(row for row in history if row['current'])['revoked_at'])

    def test_revoke_others_keeps_current_device(self):
        current = issue_tokens(self.user)
        issue_tokens(self.user)
        issue_tokens(self.user)
        self._auth(current)

        res = self.client.post(reverse('auth-sessions-revoke-others'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        listed = self.client.get(reverse('auth-sessions')).data
        self.assertEqual(len(listed), 1)
        self.assertTrue(listed[0]['current'])
        set_refresh_cookie(self.client, 'main', current['refresh'])
        still_valid = refresh_session(self.client)
        self.assertEqual(still_valid.status_code, status.HTTP_200_OK)

    def test_cannot_revoke_a_session_of_another_account(self):
        victim = User.objects.create_user(
            email='sess@example.com', password='Password@123', role=User.Role.EMPLOYER
        )
        issue_tokens(victim)
        victim_session = AuthSession.objects.get(user=victim)
        self._auth(issue_tokens(self.user))

        res = self.client.delete(reverse('auth-session-revoke', args=[victim_session.id]))

        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        victim_session.refresh_from_db()
        self.assertIsNone(victim_session.revoked_at)

    def test_refresh_rotation_keeps_one_session_with_preserved_sid(self):
        tokens = issue_tokens(self.user)
        session = AuthSession.objects.get(user=self.user)
        old_jti = session.refresh_jti

        set_refresh_cookie(self.client, 'main', tokens['refresh'])
        rotated = refresh_session(self.client)
        self.assertEqual(rotated.status_code, status.HTTP_200_OK)

        # Cùng một phiên (một hàng), chỉ đổi jti; `sid` giữ nguyên nên vẫn "current".
        self.assertEqual(AuthSession.objects.filter(user=self.user).count(), 1)
        session.refresh_from_db()
        self.assertNotEqual(session.refresh_jti, old_jti)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + rotated.data['access'])
        self.assertTrue(self.client.get(reverse('auth-sessions')).data[0]['current'])

    def test_relogin_from_same_device_and_ip_reuses_the_session(self):
        request = APIRequestFactory().post(
            '/',
            REMOTE_ADDR='203.0.113.10',
            HTTP_USER_AGENT='Mozilla/5.0 Chrome/138.0 macOS',
        )
        first = issue_tokens(self.user, request)
        first_session = AuthSession.objects.get(user=self.user)

        second = issue_tokens(self.user, request)

        self.assertEqual(AuthSession.objects.filter(user=self.user).count(), 1)
        session = AuthSession.objects.get(user=self.user)
        self.assertEqual(session.id, first_session.id)
        self.assertNotEqual(session.refresh_jti, first_session.refresh_jti)

        set_refresh_cookie(self.client, 'main', first['refresh'])
        self.assertEqual(refresh_session(self.client).status_code, status.HTTP_401_UNAUTHORIZED)
        set_refresh_cookie(self.client, 'main', second['refresh'])
        self.assertEqual(refresh_session(self.client).status_code, status.HTTP_200_OK)

    def test_different_devices_on_the_same_ip_remain_separate_sessions(self):
        chrome = APIRequestFactory().post(
            '/', REMOTE_ADDR='203.0.113.10', HTTP_USER_AGENT='Mozilla/5.0 Chrome/138.0 macOS'
        )
        safari = APIRequestFactory().post(
            '/', REMOTE_ADDR='203.0.113.10', HTTP_USER_AGENT='Mozilla/5.0 Safari/18.0 macOS'
        )

        issue_tokens(self.user, chrome)
        issue_tokens(self.user, safari)

        self.assertEqual(AuthSession.objects.filter(user=self.user).count(), 2)

    def test_access_token_without_sid_is_rejected(self):
        access = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(access))

        self.assertEqual(
            self.client.get(reverse('auth-me')).status_code, status.HTTP_401_UNAUTHORIZED
        )

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_x_forwarded_for_is_ignored_from_untrusted_peer(self):
        request = APIRequestFactory().get(
            '/',
            HTTP_X_FORWARDED_FOR='203.0.113.9',
            REMOTE_ADDR='198.51.100.7',
        )
        issue_tokens(self.user, request)
        self.assertEqual(AuthSession.objects.get(user=self.user).ip_address, '198.51.100.7')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/8'], TRUSTED_PROXY_HOPS=1)
    def test_x_forwarded_for_is_used_from_configured_proxy(self):
        request = APIRequestFactory().get(
            '/',
            HTTP_X_FORWARDED_FOR='198.51.100.7',
            REMOTE_ADDR='10.1.2.3',
        )
        issue_tokens(self.user, request)
        self.assertEqual(AuthSession.objects.get(user=self.user).ip_address, '198.51.100.7')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/8'], TRUSTED_PROXY_HOPS=1)
    def test_a_client_supplied_forwarded_for_prefix_cannot_forge_the_session_ip(self):
        """nginx dùng ``$proxy_add_x_forwarded_for`` nên NỐI lời khai của client.

        Với một hop proxy, chỉ phần tử ngoài cùng bên phải là do nginx ghi. Lấy
        phần tử đầu chuỗi tức là để client tự chọn IP hiển thị trong danh sách
        thiết bị và tự chọn bucket rate limit.
        """
        request = APIRequestFactory().get(
            '/',
            HTTP_X_FORWARDED_FOR='203.0.113.9, 198.51.100.7',
            REMOTE_ADDR='10.1.2.3',
        )
        issue_tokens(self.user, request)
        self.assertEqual(AuthSession.objects.get(user=self.user).ip_address, '198.51.100.7')

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/8'], TRUSTED_PROXY_HOPS=2)
    def test_two_configured_proxy_hops_skip_both_appended_addresses(self):
        request = APIRequestFactory().get(
            '/',
            HTTP_X_FORWARDED_FOR='203.0.113.9, 198.51.100.7, 10.9.9.9',
            REMOTE_ADDR='10.1.2.3',
        )
        issue_tokens(self.user, request)
        self.assertEqual(AuthSession.objects.get(user=self.user).ip_address, '198.51.100.7')


class ConcurrentRefreshTests(TransactionTestCase):
    # This test needs real commits/row locks. Preserve data-migration fixtures
    # (locales, benefits, footer links) when TransactionTestCase flushes tables.
    serialized_rollback = True

    def test_two_simultaneous_refreshes_create_only_one_rotation_branch(self):
        user = User.objects.create_user(email='refresh-race@example.com', password='Password@123')
        tokens = issue_tokens(user)
        gate = Barrier(2)

        def refresh_once():
            close_old_connections()
            client = APIClient()
            set_refresh_cookie(client, 'main', tokens['refresh'])
            gate.wait(timeout=5)
            response = refresh_session(client)
            close_old_connections()
            return response.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(lambda _: refresh_once(), range(2)))

        self.assertEqual(statuses, [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED])
        self.assertEqual(AuthSession.objects.filter(user=user, revoked_at__isnull=True).count(), 1)


class RefreshSessionProbeTests(APITestCase):
    def test_probe_header_is_allowed_by_cors_preflight(self):
        response = self.client.options(
            reverse('auth-refresh'),
            HTTP_ORIGIN='http://localhost:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='x-auth-portal,x-session-probe',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        allowed_headers = response['Access-Control-Allow-Headers'].lower()
        self.assertIn('x-auth-portal', allowed_headers)
        self.assertIn('x-session-probe', allowed_headers)

    def test_guest_probe_returns_no_content_instead_of_unauthorized(self):
        response = self.client.post(
            reverse('auth-refresh'),
            {'portal': 'main'},
            format='json',
            HTTP_X_SESSION_PROBE='1',
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(response.content, b'')

    def test_regular_refresh_without_cookie_remains_unauthorized(self):
        response = refresh_session(self.client)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_cookie_probe_clears_cookie_without_console_error_status(self):
        set_refresh_cookie(self.client, 'main', 'not-a-token')

        response = self.client.post(
            reverse('auth-refresh'),
            {'portal': 'main'},
            format='json',
            HTTP_X_SESSION_PROBE='1',
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(response.cookies[cookie_name('main')].value, '')


class LogoutEndpointTests(APITestCase):
    def test_logout_blacklists_the_provided_refresh_token(self):
        user = User.objects.create_user(email='logout@example.com', password='Password@123')
        tokens = issue_tokens(user)
        set_refresh_cookie(self.client, 'main', tokens['refresh'])

        response = self.client.post(reverse('auth-logout'), {'portal': 'main'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        set_refresh_cookie(self.client, 'main', tokens['refresh'])
        blocked = refresh_session(self.client)
        self.assertEqual(blocked.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_is_idempotent_for_invalid_token(self):
        set_refresh_cookie(self.client, 'main', 'not-a-token')
        response = self.client.post(reverse('auth-logout'), {'portal': 'main'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_logout_all_revokes_only_the_current_account_not_same_email_other_portal(self):
        candidate = User.objects.create_user(
            email='dual@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        employer = User.objects.create_user(
            email='dual@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        candidate_tokens = issue_tokens(candidate)
        employer_tokens = issue_tokens(employer)

        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + candidate_tokens['access'])
        response = self.client.post(reverse('auth-logout-all'))
        self.client.credentials()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        set_refresh_cookie(self.client, 'main', candidate_tokens['refresh'])
        candidate_blocked = refresh_session(self.client)
        set_refresh_cookie(self.client, 'employer', employer_tokens['refresh'])
        employer_ok = refresh_session(self.client, 'employer')
        self.assertEqual(candidate_blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(employer_ok.status_code, status.HTTP_200_OK)

    def test_logout_all_requires_authentication(self):
        response = self.client.post(reverse('auth-logout-all'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
