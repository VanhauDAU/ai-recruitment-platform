"""Chính sách bảo mật: MFA bắt buộc cho admin, last_login, rate limit, email job."""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .. import oauth
from ..models import AuthEmailJob, User
from ..services import email_verification, password_reset, two_factor
from ..services.refresh_cookies import cookie_name
from ..services.tokens import issue_tokens
from ..tasks import deliver_auth_email_job
from .helpers import GOOGLE_PROFILE, refresh_session


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    ADMIN_ACCESS_TOKEN_MINUTES=5,
)
class AdminAuthenticationPolicyTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            email='workspace-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )

    def test_admin_without_mfa_cannot_login_workspace(self):
        response = self.client.post(
            reverse('auth-login'),
            {
                'email': self.admin.email,
                'password': 'Password@123',
                'captcha_token': 'x',
                'portal': 'admin',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'admin_mfa_required')
        self.assertNotIn(cookie_name('admin'), response.cookies)

    def test_admin_mfa_issues_five_minute_access_and_httponly_refresh_cookie(self):
        self.admin.two_factor_enabled = True
        self.admin.save(update_fields=['two_factor_enabled'])
        login = self.client.post(
            reverse('auth-login'),
            {
                'email': self.admin.email,
                'password': 'Password@123',
                'captcha_token': 'x',
                'portal': 'admin',
            },
        )
        code = cache.get(two_factor._code_key(self.admin.pk, two_factor.PURPOSE_LOGIN))
        verified = self.client.post(
            reverse('auth-two-factor-login-verify'),
            {
                'challenge': login.data['challenge'],
                'code': code,
            },
        )

        self.assertEqual(verified.status_code, status.HTTP_200_OK)
        access = AccessToken(verified.data['access'])
        self.assertLessEqual(access['exp'] - access['iat'], 5 * 60)
        self.assertNotIn('refresh', verified.data)
        cookie = verified.cookies[cookie_name('admin')]
        self.assertTrue(cookie['httponly'])

    def test_admin_public_password_reset_is_rejected(self):
        response = self.client.post(
            reverse('auth-password-reset'),
            {
                'email': self.admin.email,
                'captcha_token': 'x',
                'portal': 'admin',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    ALLOWED_HOSTS=['testserver'],
    # ScopedRateThrottle (5/min cho scope 'login') dùng chung cache 'default' —
    # nếu không cô lập, số request cộng dồn qua nhiều lần chạy test trong cùng
    # Redis thật sẽ kích hoạt 429 giả (đã từng gặp phải khi rerun cùng phiên).
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class LastLoginTests(APITestCase):
    """Verify all JWT issuance flows update ``last_login`` consistently."""

    # Django test runner luôn ép DEBUG=False bất kể .env; bypass captcha trong
    # verify_recaptcha() chỉ áp dụng khi DEBUG=True nên phải override tường minh.

    def setUp(self):
        cache.clear()

    def test_password_login_updates_last_login(self):
        user = User.objects.create_user(email='login@example.com', password='Password@123')
        self.assertIsNone(user.last_login)

        response = self.client.post(
            reverse('auth-login'),
            {
                'email': 'login@example.com',
                'password': 'Password@123',
                'captcha_token': 'x',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertIsNotNone(user.last_login)

    def test_wrong_password_does_not_update_last_login(self):
        user = User.objects.create_user(email='login2@example.com', password='Password@123')

        response = self.client.post(
            reverse('auth-login'),
            {
                'email': 'login2@example.com',
                'password': 'wrong',
                'captcha_token': 'x',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        user.refresh_from_db()
        self.assertIsNone(user.last_login)

    def test_login_is_scoped_per_portal_account(self):
        """Mô hình tách cổng: cùng email có 2 tài khoản (ứng viên/NTD) mật khẩu
        riêng; đăng nhập mỗi cổng chỉ chấp nhận mật khẩu của tài khoản cổng đó."""
        User.objects.create_user(
            email='dual@example.com',
            password='CandPass@123',
            role=User.Role.CANDIDATE,
        )
        User.objects.create_user(
            email='dual@example.com',
            password='EmpPass@123',
            role=User.Role.EMPLOYER,
        )

        def login(portal, password):
            return self.client.post(
                reverse('auth-login'),
                {
                    'email': 'dual@example.com',
                    'password': password,
                    'captcha_token': 'x',
                    'portal': portal,
                },
            )

        # Đúng cổng, đúng mật khẩu -> token đúng role.
        emp_ok = login('employer', 'EmpPass@123')
        self.assertEqual(emp_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(AccessToken(emp_ok.data['access'])['role'], 'employer')

        cand_ok = login('main', 'CandPass@123')
        self.assertEqual(cand_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(AccessToken(cand_ok.data['access'])['role'], 'candidate')

        # Mật khẩu của cổng kia KHÔNG mở được cổng này.
        self.assertEqual(
            login('employer', 'CandPass@123').status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.assertEqual(login('main', 'EmpPass@123').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_wrong_portal_account_absent_is_unauthorized(self):
        """Chỉ có tài khoản ứng viên; đăng nhập cổng NTD -> không có tài khoản NTD
        -> 401 (không lộ việc email tồn tại ở cổng khác)."""
        user = User.objects.create_user(
            email='login3@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        response = self.client.post(
            reverse('auth-login'),
            {
                'email': 'login3@example.com',
                'password': 'Password@123',
                'captcha_token': 'x',
                'portal': 'employer',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        user.refresh_from_db()
        self.assertIsNone(user.last_login)

    def test_banned_or_deleted_user_cannot_log_in(self):
        for suffix, fields in (
            ('banned', {'status': User.Status.BANNED}),
            ('deleted', {'is_deleted': True}),
        ):
            user = User.objects.create_user(email=f'{suffix}@example.com', password='Password@123')
            User.objects.filter(pk=user.pk).update(**fields)
            response = self.client.post(
                reverse('auth-login'),
                {
                    'email': user.email,
                    'password': 'Password@123',
                    'captcha_token': 'x',
                },
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_banned_user_cannot_reuse_access_or_refresh_token(self):
        user = User.objects.create_user(email='revoked@example.com', password='Password@123')
        login = self.client.post(
            reverse('auth-login'),
            {
                'email': user.email,
                'password': 'Password@123',
                'captcha_token': 'x',
            },
        )
        User.objects.filter(pk=user.pk).update(status=User.Status.BANNED)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')
        self.assertEqual(
            self.client.get(reverse('auth-me')).status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.client.credentials()
        refresh = refresh_session(self.client)
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_auto_login_sets_last_login(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'email': 'newuser@example.com',
                'password': 'Password@123456',
                'role': 'candidate',
                'captcha_token': 'x',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='newuser@example.com')
        self.assertIsNotNone(user.last_login)

    def test_register_rejects_password_shorter_than_eight_characters(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'email': 'short-password@example.com',
                'password': 'short',
                'role': 'candidate',
                'captcha_token': 'x',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_register_rejects_password_without_required_character_types(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'email': 'weak-password@example.com',
                'password': 'matkhaudai',
                'role': 'candidate',
                'captcha_token': 'x',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
        OAUTH_GOOGLE_CLIENT_ID='test-client-id',
        OAUTH_GOOGLE_CLIENT_SECRET='test-client-secret',
    )
    def test_oauth_login_sets_last_login(self):
        cache.clear()
        state = oauth.create_state('google', 'main', '')
        with (
            patch.object(oauth, 'exchange_code', return_value='provider-token'),
            patch.object(oauth, 'fetch_profile', return_value=dict(GOOGLE_PROFILE)),
        ):
            callback = self.client.get(
                reverse('auth-oauth-callback', args=['google']),
                {'code': 'provider-code', 'state': state},
            )
        query = parse_qs(urlparse(callback.url).query)
        self.client.post(reverse('auth-oauth-complete'), {'code': query['code'][0]})

        user = User.objects.get(email='social@example.com')
        self.assertIsNotNone(user.last_login)


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='https://main.example.test',
    EMPLOYER_FRONTEND_URL='https://employer.example.test',
    EMPLOYER_EMAIL_VERIFICATION_PATH='/app/account/verify',
    EMPLOYER_PASSWORD_RESET_PATH='/app/reset-password',
)
class AuthSecurityAndEmailTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_verification_token_is_consumed_once(self):
        user = User.objects.create_user(email='verify@example.com', password='Password@123')
        token = email_verification.issue_token(user)

        self.assertEqual(email_verification.consume_token(token), user.pk)
        self.assertIsNone(email_verification.consume_token(token))

    def test_password_reset_token_is_consumed_once(self):
        user = User.objects.create_user(email='reset@example.com', password='Password@123')
        token = password_reset.issue_token(user)

        self.assertEqual(password_reset.consume_token(token), user.pk)
        self.assertIsNone(password_reset.consume_token(token))

    def test_employer_password_reset_does_not_revoke_same_email_candidate_session(self):
        candidate = User.objects.create_user(
            email='reset-isolation@example.com',
            password='CandidatePass@123',
            role=User.Role.CANDIDATE,
        )
        employer = User.objects.create_user(
            email='reset-isolation@example.com',
            password='EmployerPass@123',
            role=User.Role.EMPLOYER,
        )
        candidate_tokens = issue_tokens(candidate)
        reset_token = password_reset.issue_token(employer)

        reset = self.client.post(
            reverse('auth-password-reset-confirm'),
            {
                'token': reset_token,
                'password': 'EmployerNewPass@123',
            },
            format='json',
        )
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + candidate_tokens['access'])
        candidate_me = self.client.get(reverse('auth-me'))

        self.assertEqual(reset.status_code, status.HTTP_200_OK, reset.data)
        self.assertEqual(candidate_me.status_code, status.HTTP_200_OK, candidate_me.data)
        candidate.refresh_from_db()
        employer.refresh_from_db()
        self.assertTrue(candidate.check_password('CandidatePass@123'))
        self.assertTrue(employer.check_password('EmployerNewPass@123'))

    def test_employer_verification_email_uses_employer_portal_link(self):
        user = User.objects.create_user(
            email='employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )

        email_verification.send_verification_email(user)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(
            'https://employer.example.test/app/account/verify?token=', mail.outbox[0].body
        )
        self.assertIn('Mã NTD', mail.outbox[0].body)
        self.assertIn('Xác thực tài khoản', mail.outbox[0].alternatives[0][0])

    def test_employer_password_reset_email_uses_employer_portal_link(self):
        user = User.objects.create_user(
            email='employer-reset@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )

        password_reset.send_password_reset_email(user)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(
            'https://employer.example.test/app/reset-password?token=', mail.outbox[0].body
        )

    def test_email_outbox_job_is_marked_sent_after_delivery(self):
        user = User.objects.create_user(email='queue@example.com', password='Password@123')
        job = AuthEmailJob.objects.create(user=user, kind=AuthEmailJob.Kind.VERIFICATION)

        deliver_auth_email_job.run(job.pk)

        job.refresh_from_db()
        self.assertEqual(job.status, AuthEmailJob.Status.SENT)
        self.assertEqual(job.attempts, 1)
        self.assertIsNotNone(job.sent_at)

    def test_verification_confirmation_queues_one_welcome_email(self):
        user = User.objects.create_user(email='new@example.com', password='Password@123')
        token = email_verification.issue_token(user)

        response = self.client.post(reverse('auth-verify-confirm'), {'token': token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).exists()
        )

    def test_employer_verification_queues_one_employer_welcome_email(self):
        user = User.objects.create_user(
            email='employer-welcome@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        token = email_verification.issue_token(user)

        response = self.client.post(reverse('auth-verify-confirm'), {'token': token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        job = AuthEmailJob.objects.get(user=user, kind=AuthEmailJob.Kind.WELCOME)
        self.assertEqual(job.context, {'registration_method': 'email'})

        reused = self.client.post(reverse('auth-verify-confirm'), {'token': token})
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).count(),
            1,
        )

    def test_welcome_email_is_delivered_from_the_outbox(self):
        user = User.objects.create_user(
            email='welcome@example.com', password='Password@123', email_verified=True
        )
        job = AuthEmailJob.objects.create(user=user, kind=AuthEmailJob.Kind.WELCOME)

        deliver_auth_email_job.run(job.pk)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Chào mừng', mail.outbox[0].subject)

    def test_employer_welcome_email_uses_employer_content_and_portal_link(self):
        user = User.objects.create_user(
            email='hr-welcome@example.com',
            password=None,
            role=User.Role.EMPLOYER,
            full_name='Nguyễn Minh Anh',
            email_verified=True,
        )
        job = AuthEmailJob.objects.create(
            user=user,
            kind=AuthEmailJob.Kind.WELCOME,
            context={'registration_method': 'google'},
        )

        deliver_auth_email_job.run(job.pk)

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(
            message.subject,
            'Chúc mừng Nguyễn Minh Anh đã có tài khoản dành cho nhà tuyển dụng',
        )
        self.assertIn(f'Mã NTD {user.public_id}', message.body)
        self.assertIn('Google đã xác thực địa chỉ email', message.body)
        self.assertIn('https://employer.example.test/tuyendung/app/employer-verify', message.body)
        self.assertIn('Tiếp tục thiết lập tài khoản', message.alternatives[0][0])
