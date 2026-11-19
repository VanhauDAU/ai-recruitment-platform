"""Tầng HTTP: đổi mật khẩu và yêu cầu thiết lập mật khẩu."""

from datetime import timedelta

from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import AuthSession, SocialAccount, User
from ..services.refresh_cookies import cookie_name
from ..services.tokens import issue_tokens
from .factories import refresh_session, set_refresh_cookie


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


class PasswordSetupRequirementsTests(APITestCase):
    """GET trả điều kiện để client cảnh báo TRƯỚC khi người dùng điền form."""

    def _authenticate(self, user, portal, *, auth_method='password'):
        tokens = issue_tokens(user, auth_method=auth_method)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        set_refresh_cookie(self.client, portal, tokens['refresh'])

    def test_account_with_password_never_needs_reauthentication(self):
        user = User.objects.create_user(
            email='local-requirements@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self._authenticate(user, 'employer')

        response = self.client.get(reverse('auth-password-change'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['has_usable_password'])
        self.assertFalse(response.data['requires_reauth'])
        self.assertIsNone(response.data['reauth_provider'])

    def test_fresh_oauth_session_can_set_the_first_password(self):
        user = User.objects.create_user(
            email='fresh-oauth@example.com',
            password=None,
            role=User.Role.EMPLOYER,
        )
        SocialAccount.objects.create(
            user=user, provider=User.Provider.GOOGLE, provider_user_id='google-fresh'
        )
        self._authenticate(user, 'employer', auth_method='oauth')

        response = self.client.get(reverse('auth-password-change'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data['has_usable_password'])
        self.assertFalse(response.data['requires_reauth'])

    def test_stale_oauth_session_reports_the_provider_to_reauthenticate_with(self):
        user = User.objects.create_user(
            email='stale-oauth@example.com',
            password=None,
            role=User.Role.CANDIDATE,
        )
        SocialAccount.objects.create(
            user=user, provider=User.Provider.FACEBOOK, provider_user_id='fb-stale'
        )
        self._authenticate(user, 'main', auth_method='oauth')
        AuthSession.objects.filter(user=user).update(
            reauthenticated_at=timezone.now()
            - timedelta(seconds=settings.AUTH_REAUTH_MAX_AGE_SECONDS + 60)
        )

        requirements = self.client.get(reverse('auth-password-change'))
        rejected = self.client.post(
            reverse('auth-password-change'),
            {'password': 'NewPassword@123'},
            format='json',
        )

        self.assertEqual(requirements.status_code, status.HTTP_200_OK, requirements.data)
        self.assertTrue(requirements.data['requires_reauth'])
        self.assertEqual(requirements.data['reauth_provider'], 'facebook')
        self.assertEqual(
            requirements.data['reauth_max_age_seconds'], settings.AUTH_REAUTH_MAX_AGE_SECONDS
        )
        # Cùng một luật ở cả hai method: cảnh báo sớm khớp với quyết định lúc lưu.
        self.assertEqual(rejected.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(rejected.data['code'], 'reauth_required')
        self.assertEqual(rejected.data['reauth_provider'], 'facebook')
        user.refresh_from_db()
        self.assertFalse(user.has_usable_password())

    def test_reauthenticating_with_the_provider_unblocks_the_first_password(self):
        user = User.objects.create_user(
            email='reauth-oauth@example.com',
            password=None,
            role=User.Role.CANDIDATE,
        )
        SocialAccount.objects.create(
            user=user, provider=User.Provider.GOOGLE, provider_user_id='google-reauth'
        )
        self._authenticate(user, 'main', auth_method='oauth')
        AuthSession.objects.filter(user=user).update(
            reauthenticated_at=timezone.now()
            - timedelta(seconds=settings.AUTH_REAUTH_MAX_AGE_SECONDS + 60)
        )
        self.assertTrue(self.client.get(reverse('auth-password-change')).data['requires_reauth'])

        # Đăng nhập OAuth lại trên cùng thiết bị: `start_session` làm mới mốc.
        self._authenticate(user, 'main', auth_method='oauth')

        requirements = self.client.get(reverse('auth-password-change'))
        accepted = self.client.post(
            reverse('auth-password-change'),
            {'password': 'NewPassword@123'},
            format='json',
        )

        self.assertFalse(requirements.data['requires_reauth'])
        self.assertEqual(accepted.status_code, status.HTTP_200_OK, accepted.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPassword@123'))

    def test_access_token_without_the_refresh_cookie_is_not_a_current_session(self):
        user = User.objects.create_user(
            email='no-cookie-requirements@example.com',
            password=None,
            role=User.Role.CANDIDATE,
        )
        SocialAccount.objects.create(
            user=user, provider=User.Provider.GOOGLE, provider_user_id='google-no-cookie'
        )
        tokens = issue_tokens(user, auth_method='oauth')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

        response = self.client.get(reverse('auth-password-change'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['requires_reauth'])
