"""Tầng HTTP: đổi mật khẩu và yêu cầu thiết lập mật khẩu."""

from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import AuthEmailJob, User
from ..services import password_setup_code
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

    def test_oauth_user_creates_first_password_with_the_email_code(self):
        user = User.objects.create_user(
            email='oauth-employer@example.com',
            password=None,
            role=User.Role.EMPLOYER,
        )
        tokens = issue_tokens(user, auth_method='oauth')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        set_refresh_cookie(self.client, 'employer', tokens['refresh'])
        code = password_setup_code.issue_code(user)

        missing = self.client.post(
            reverse('auth-password-change'), {'password': 'NewPassword@123'}, format='json'
        )
        response = self.client.post(
            reverse('auth-password-change'),
            {'password': 'NewPassword@123', 'email_code': code},
            format='json',
        )

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email_code', missing.data)
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


class PasswordSetupCodeTests(APITestCase):
    """Tài khoản chưa có mật khẩu chứng minh chủ sở hữu bằng mã gửi qua email."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='oauth-candidate@example.com', password=None, role=User.Role.CANDIDATE
        )
        tokens = issue_tokens(self.user, auth_method='oauth')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        set_refresh_cookie(self.client, 'main', tokens['refresh'])

    def test_requirements_ask_for_an_email_code_only_without_a_password(self):
        response = self.client.get(reverse('auth-password-change'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data['has_usable_password'])
        self.assertTrue(response.data['requires_email_code'])
        self.assertEqual(response.data['resend_after_seconds'], 0)

        local = User.objects.create_user(
            email='local-requirements@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + issue_tokens(local)['access'])
        self.assertFalse(
            self.client.get(reverse('auth-password-change')).data['requires_email_code']
        )

    @patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay')
    def test_sending_a_code_queues_one_email_and_starts_a_cooldown(self, _delay):
        with self.captureOnCommitCallbacks(execute=True):
            sent = self.client.post(reverse('auth-password-setup-code'))
        again = self.client.post(reverse('auth-password-setup-code'))

        self.assertEqual(sent.status_code, status.HTTP_200_OK, sent.data)
        self.assertGreater(sent.data['resend_after_seconds'], 0)
        self.assertEqual(again.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(again.data['code'], 'password_setup_code_cooldown')
        jobs = AuthEmailJob.objects.filter(
            user=self.user, kind=AuthEmailJob.Kind.PASSWORD_SETUP_CODE
        )
        self.assertEqual(jobs.count(), 1)

    def test_account_with_a_password_cannot_request_a_code(self):
        self.user.set_password('Password@123')
        self.user.save()

        response = self.client.post(reverse('auth-password-setup-code'))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_wrong_codes_are_limited_and_burn_the_code(self):
        code = password_setup_code.issue_code(self.user)
        for _ in range(password_setup_code.MAX_ATTEMPTS):
            wrong = self.client.post(
                reverse('auth-password-change'),
                {
                    'password': 'NewPassword@123',
                    'email_code': '000000' if code != '000000' else '111111',
                },
                format='json',
            )
            self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)

        late = self.client.post(
            reverse('auth-password-change'),
            {'password': 'NewPassword@123', 'email_code': code},
            format='json',
        )

        self.assertEqual(late.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertFalse(self.user.has_usable_password())

    @patch('apps.accounts.services.password_setup_code.send_html_email')
    def test_worker_emails_a_code_that_unlocks_the_first_password(self, send):
        sent = password_setup_code.send_code_email(
            self.user,
            expected_email=self.user.email,
            expected_auth_revision=self.user.auth_revision,
        )
        code = send.call_args.kwargs['subject'].split(' ', 1)[0]
        stale = password_setup_code.send_code_email(
            self.user,
            expected_email='other@example.com',
            expected_auth_revision=self.user.auth_revision,
        )

        self.assertTrue(sent)
        self.assertFalse(stale)
        self.assertIn(code, send.call_args.kwargs['text'])
        self.assertTrue(password_setup_code.verify_code(self.user, code))
        # Mã chỉ dùng một lần.
        self.assertFalse(password_setup_code.verify_code(self.user, code))
