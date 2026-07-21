"""Tầng HTTP: avatar, hồ sơ, đổi mật khẩu, đổi email, phiên đăng nhập, logout."""

import shutil
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from ..models import AuthSession, User
from ..services.refresh_cookies import cookie_name
from ..services.tokens import issue_tokens
from .helpers import PNG_BYTES, TEST_MEDIA_ROOT, refresh_session, set_refresh_cookie


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class AvatarUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def test_authenticated_user_can_upload_avatar_to_media_storage(self):
        user = User.objects.create_user(email='candidate@example.com', password='Password@123')
        self.client.force_authenticate(user=user)

        upload = SimpleUploadedFile('avatar.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('auth-avatar-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('/media/users/avatars/', response.data['avatar_url'])
        user.refresh_from_db()
        self.assertTrue(user.avatar_url.startswith('users/avatars/'))
        self.assertNotIn('://', user.avatar_url)


class ProfileUpdateTests(APITestCase):
    """PATCH /auth/me/: sửa họ tên + SĐT nhiều lần, email không đổi."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='candidate@example.com',
            password='Password@123',
            full_name='Tên Cũ',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('auth-me')

    def test_update_name_and_phone(self):
        response = self.client.patch(self.url, {'full_name': 'Lê Văn Hậu', 'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'Lê Văn Hậu')
        self.assertEqual(response.data['phone'], '0912345678')
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'Lê Văn Hậu')
        self.assertEqual(self.user.phone, '0912345678')

    def test_me_response_contains_session_fields_only(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                'public_id',
                'email',
                'role',
                'full_name',
                'phone',
                'avatar_url',
                'email_verified',
                'two_factor_enabled',
                'two_factor_email_enabled',
                'two_factor_totp_enabled',
                'two_factor_backup_codes_enabled',
                'job_preferences_configured',
                'has_usable_password',
                'employer_onboarding_required',
                'employer_onboarding_step',
                'employer_verification_completed',
            },
        )
        self.assertIs(response.data['job_preferences_configured'], False)
        self.assertIs(response.data['has_usable_password'], True)
        self.assertIs(response.data['employer_verification_completed'], False)
        self.assertTrue(
            {
                'id',
                'password',
                'token',
                'refresh_token',
                'permissions',
                'status',
                'date_joined',
                'last_login',
            }.isdisjoint(response.data)
        )

    def test_can_update_multiple_times(self):
        self.client.patch(self.url, {'full_name': 'Lần 1', 'phone': '0900000001'})
        response = self.client.patch(self.url, {'full_name': 'Lần 2', 'phone': '0900000002'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'Lần 2')
        self.assertEqual(self.user.phone, '0900000002')

    def test_email_is_read_only(self):
        response = self.client.patch(
            self.url,
            {'full_name': 'Ai Đó', 'email': 'hacker@evil.com'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'candidate@example.com')

    def test_invalid_phone_rejected(self):
        response = self.client.patch(self.url, {'full_name': 'Hợp Lệ', 'phone': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)

    def test_blank_name_rejected(self):
        response = self.client.patch(self.url, {'full_name': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('full_name', response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(self.url, {'full_name': 'X'})
        self.assertIn(response.status_code, (401, 403))


class PasswordChangeTests(APITestCase):
    def test_candidate_password_change_does_not_change_same_email_employer(self):
        candidate = User.objects.create_user(
            email='password-isolation@example.com',
            password='CandidatePass@123',
            role=User.Role.CANDIDATE,
        )
        employer = User.objects.create_user(
            email='password-isolation@example.com',
            password='EmployerPass@123',
            role=User.Role.EMPLOYER,
        )
        tokens = issue_tokens(candidate)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        set_refresh_cookie(self.client, 'main', tokens['refresh'])

        response = self.client.post(
            reverse('auth-password-change'),
            {
                'current_password': 'CandidatePass@123',
                'password': 'CandidateNewPass@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        candidate.refresh_from_db()
        employer.refresh_from_db()
        self.assertTrue(candidate.check_password('CandidateNewPass@123'))
        self.assertTrue(employer.check_password('EmployerPass@123'))

    def test_change_without_current_refresh_cookie_is_rejected(self):
        user = User.objects.create_user(
            email='missing-refresh@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        tokens = issue_tokens(user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

        response = self.client.post(
            reverse('auth-password-change'),
            {
                'current_password': 'Password@123',
                'password': 'NewPassword@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertTrue(user.check_password('Password@123'))

    def test_oauth_user_can_create_first_password_without_current_password(self):
        user = User.objects.create_user(
            email='oauth-employer@example.com',
            password=None,
            role=User.Role.EMPLOYER,
        )
        tokens = issue_tokens(user, auth_method='oauth')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        set_refresh_cookie(self.client, 'employer', tokens['refresh'])

        response = self.client.post(
            reverse('auth-password-change'),
            {
                'password': 'NewPassword@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPassword@123'))
        self.assertTrue(response.data['user']['has_usable_password'])

    def test_existing_password_requires_correct_current_password(self):
        user = User.objects.create_user(
            email='local-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=user)

        missing = self.client.post(
            reverse('auth-password-change'),
            {
                'password': 'NewPassword@123',
            },
            format='json',
        )
        wrong = self.client.post(
            reverse('auth-password-change'),
            {
                'current_password': 'WrongPassword@123',
                'password': 'NewPassword@123',
            },
            format='json',
        )

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', missing.data)
        self.assertIn('current_password', wrong.data)

    def test_change_rotates_current_session_and_returns_fresh_tokens(self):
        user = User.objects.create_user(
            email='rotate@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        old_tokens = issue_tokens(user)
        old_refresh = old_tokens['refresh']
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + old_tokens['access'])
        set_refresh_cookie(self.client, 'employer', old_refresh)

        response = self.client.post(
            reverse('auth-password-change'),
            {
                'current_password': 'Password@123',
                'password': 'NewPassword@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertNotIn('refresh', response.data['tokens'])
        new_refresh = self.client.cookies[cookie_name('employer')].value

        # Refresh token của phiên hiện tại bị xoay: token cũ hỏng, token mới dùng được.
        self.client.credentials()
        set_refresh_cookie(self.client, 'employer', old_refresh)
        old_blocked = refresh_session(self.client, 'employer')
        set_refresh_cookie(self.client, 'employer', new_refresh)
        new_ok = refresh_session(self.client, 'employer')
        self.assertEqual(old_blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(new_ok.status_code, status.HTTP_200_OK)

    def test_change_with_logout_all_revokes_other_devices_but_keeps_current(self):
        user = User.objects.create_user(
            email='logoutall@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        other_device = issue_tokens(user)
        current = issue_tokens(user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + current['access'])
        set_refresh_cookie(self.client, 'employer', current['refresh'])

        response = self.client.post(
            reverse('auth-password-change'),
            {
                'current_password': 'Password@123',
                'password': 'NewPassword@123',
                'logout_all_sessions': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        new_refresh = self.client.cookies[cookie_name('employer')].value
        self.client.credentials()
        set_refresh_cookie(self.client, 'employer', other_device['refresh'])
        other_blocked = refresh_session(self.client, 'employer')
        set_refresh_cookie(self.client, 'employer', new_refresh)
        current_ok = refresh_session(self.client, 'employer')
        self.assertEqual(other_blocked.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(current_ok.status_code, status.HTTP_200_OK)


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

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/8'])
    def test_x_forwarded_for_is_used_from_configured_proxy(self):
        request = APIRequestFactory().get(
            '/',
            HTTP_X_FORWARDED_FOR='203.0.113.9, 10.1.2.3',
            REMOTE_ADDR='10.1.2.3',
        )
        issue_tokens(self.user, request)
        self.assertEqual(AuthSession.objects.get(user=self.user).ip_address, '203.0.113.9')


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


class ChangeEmailTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _user(self):
        return User.objects.create_user(email='pending@example.com', password='Password@123')

    def test_change_email_requires_current_password(self):
        user = self._user()
        self.client.force_authenticate(user=user)

        wrong = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'new@example.com',
                'current_password': 'Wrong@123',
            },
            format='json',
        )

        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', wrong.data)
        user.refresh_from_db()
        self.assertEqual(user.email, 'pending@example.com')

    def test_change_email_rejected_when_already_verified(self):
        user = self._user()
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'new@example.com',
                'current_password': 'Password@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertEqual(user.email, 'pending@example.com')

    def test_change_email_success_resets_verification_and_warns_old_address(self):
        user = self._user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'new@example.com',
                'current_password': 'Password@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertEqual(user.email, 'new@example.com')
        self.assertFalse(user.email_verified)
        # Mail cảnh báo (gửi đồng bộ) phải tới đúng địa chỉ CŨ.
        warning = [msg for msg in mail.outbox if 'pending@example.com' in msg.to]
        self.assertEqual(len(warning), 1)
        self.assertIn('thay đổi', warning[0].subject.lower())


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


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class RegisterEmailAvailabilityTests(APITestCase):
    """Pre-check chỉ phục vụ UX; RegisterSerializer vẫn là điểm chặn cuối."""

    def setUp(self):
        cache.clear()
        self.url = reverse('auth-register-email-availability')

    def test_returns_availability_case_insensitively(self):
        User.objects.create_user(email='existing@example.com', password='Password@123')

        taken = self.client.post(self.url, {'email': 'EXISTING@example.com'})
        available = self.client.post(self.url, {'email': 'new@example.com'})

        self.assertEqual(taken.status_code, status.HTTP_200_OK)
        self.assertEqual(taken.data, {'available': False})
        self.assertEqual(available.status_code, status.HTTP_200_OK)
        self.assertEqual(available.data, {'available': True})

    def test_rejects_invalid_email_before_querying(self):
        response = self.client.post(self.url, {'email': 'not-an-email'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
