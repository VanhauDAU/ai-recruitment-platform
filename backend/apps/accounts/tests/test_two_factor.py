"""Xác minh hai bước: bật/tắt, TOTP, mã dự phòng, challenge khi đăng nhập."""

from time import time
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import User
from ..services import two_factor
from ..services.refresh_cookies import cookie_name


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    ALLOWED_HOSTS=['testserver'],
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    TWO_FACTOR_CODE_TTL=180,
)
class TwoFactorAuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='twofactor@example.com', password='Password@123')

    def test_user_can_enable_two_factor_with_email_code(self):
        self.client.force_authenticate(user=self.user)
        sent = self.client.post(reverse('auth-two-factor-setup-send'))

        self.assertEqual(sent.status_code, status.HTTP_200_OK)
        self.assertEqual(sent.data['expires_in'], 180)
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_SETUP))
        self.assertRegex(code, r'^\d{6}$')

        confirmed = self.client.post(reverse('auth-two-factor-setup-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertTrue(confirmed.data['two_factor_enabled'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.two_factor_enabled)
        self.assertIsNone(cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_SETUP)))

    def test_two_factor_login_only_issues_tokens_after_correct_code(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=['two_factor_enabled'])

        login = self.client.post(
            reverse('auth-login'),
            {
                'email': self.user.email,
                'password': 'Password@123',
                'captcha_token': 'x',
                'portal': 'main',
            },
        )
        self.assertEqual(login.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(login.data['two_factor_required'])
        self.assertNotIn('access', login.data)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.last_login)

        challenge = login.data['challenge']
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_LOGIN))
        wrong_code = '000001' if code == '000000' else '000000'
        wrong = self.client.post(
            reverse('auth-two-factor-login-verify'), {'challenge': challenge, 'code': wrong_code}
        )
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)

        verified = self.client.post(
            reverse('auth-two-factor-login-verify'), {'challenge': challenge, 'code': code}
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK)
        self.assertIn('access', verified.data)
        self.assertNotIn('refresh', verified.data)
        self.assertTrue(self.client.cookies[cookie_name('main')].value)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_two_factor_code_is_invalidated_after_too_many_wrong_attempts(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=['two_factor_enabled'])
        login = self.client.post(
            reverse('auth-login'),
            {
                'email': self.user.email,
                'password': 'Password@123',
                'captcha_token': 'x',
                'portal': 'main',
            },
        )
        challenge = login.data['challenge']
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_LOGIN))
        wrong = '000001' if code == '000000' else '000000'

        for _ in range(two_factor.MAX_VERIFY_ATTEMPTS):
            self.client.post(
                reverse('auth-two-factor-login-verify'), {'challenge': challenge, 'code': wrong}
            )

        # Mã đã bị hủy sau 5 lần sai: mã đúng cũng không còn dùng được.
        self.assertIsNone(cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_LOGIN)))
        replay = self.client.post(
            reverse('auth-two-factor-login-verify'), {'challenge': challenge, 'code': code}
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_can_disable_two_factor_with_email_code(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=['two_factor_enabled'])
        self.client.force_authenticate(user=self.user)

        sent = self.client.post(reverse('auth-two-factor-disable-send'))
        self.assertEqual(sent.status_code, status.HTTP_200_OK)
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_DISABLE))

        confirmed = self.client.post(reverse('auth-two-factor-disable-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertFalse(confirmed.data['two_factor_enabled'])
        self.user.refresh_from_db()
        self.assertFalse(self.user.two_factor_enabled)

    def test_employer_can_enroll_totp_without_storing_the_plain_secret(self):
        employer = User.objects.create_user(
            email='employer-totp@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=employer)

        setup = self.client.post(reverse('auth-employer-totp-setup'))
        self.assertEqual(setup.status_code, status.HTTP_200_OK, setup.data)
        self.assertIn('otpauth://totp/', setup.data['otpauth_url'])
        secret = setup.data['manual_key']
        code = two_factor._totp_code(secret, int(time() // two_factor.TOTP_PERIOD_SECONDS))

        confirmed = self.client.post(reverse('auth-employer-totp-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)
        self.assertTrue(confirmed.data['two_factor_totp_enabled'])
        employer.refresh_from_db()
        self.assertTrue(employer.two_factor_enabled)
        self.assertNotEqual(employer.two_factor_totp_secret, secret)
        self.assertTrue(two_factor.verify_user_totp(employer, code))

    def test_employer_with_totp_only_can_generate_backup_codes(self):
        employer = User.objects.create_user(
            email='employer-totp-backup@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=employer)
        setup = self.client.post(reverse('auth-employer-totp-setup'))
        secret = setup.data['manual_key']
        code = two_factor._totp_code(secret, int(time() // two_factor.TOTP_PERIOD_SECONDS))
        confirmed = self.client.post(reverse('auth-employer-totp-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)

        generated = self.client.post(
            reverse('auth-employer-backup-codes'), {'method': 'totp', 'code': code}
        )
        self.assertEqual(generated.status_code, status.HTTP_200_OK, generated.data)
        self.assertFalse(generated.data['two_factor_email_enabled'])
        self.assertTrue(generated.data['two_factor_totp_enabled'])
        self.assertEqual(len(generated.data['backup_codes']), two_factor.BACKUP_CODE_COUNT)

        disabled = self.client.post(reverse('auth-employer-totp-disable'), {'code': code})
        self.assertEqual(disabled.status_code, status.HTTP_200_OK, disabled.data)
        self.assertFalse(disabled.data['two_factor_enabled'])
        self.assertFalse(disabled.data['two_factor_backup_codes_enabled'])

    def test_employer_can_disable_each_method_with_another_enabled_method(self):
        employer = User.objects.create_user(
            email='employer-method-switch@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=employer)
        two_factor.issue_code(employer, two_factor.PURPOSE_SETUP)
        email_code = cache.get(two_factor._code_key(employer.pk, two_factor.PURPOSE_SETUP))
        email_confirmed = self.client.post(
            reverse('auth-two-factor-setup-confirm'), {'code': email_code}
        )
        self.assertEqual(email_confirmed.status_code, status.HTTP_200_OK, email_confirmed.data)
        backup_code = email_confirmed.data['backup_codes'][0]

        setup = self.client.post(reverse('auth-employer-totp-setup'))
        secret = setup.data['manual_key']
        totp_code = two_factor._totp_code(secret, int(time() // two_factor.TOTP_PERIOD_SECONDS))
        totp_confirmed = self.client.post(
            reverse('auth-employer-totp-confirm'), {'code': totp_code}
        )
        self.assertEqual(totp_confirmed.status_code, status.HTTP_200_OK, totp_confirmed.data)

        # Email step-up can disable TOTP.
        two_factor.issue_code(employer, two_factor.PURPOSE_DISABLE)
        disable_email_code = cache.get(
            two_factor._code_key(employer.pk, two_factor.PURPOSE_DISABLE)
        )
        totp_disabled = self.client.post(
            reverse('auth-employer-two-factor-method-disable'),
            {
                'target': 'totp',
                'method': 'email',
                'code': disable_email_code,
            },
        )
        self.assertEqual(totp_disabled.status_code, status.HTTP_200_OK, totp_disabled.data)
        self.assertFalse(totp_disabled.data['two_factor_totp_enabled'])
        self.assertTrue(totp_disabled.data['two_factor_email_enabled'])

        # A recovery code can disable email; as the final primary method, it also clears the remaining recovery codes.
        email_disabled = self.client.post(
            reverse('auth-employer-two-factor-method-disable'),
            {
                'target': 'email',
                'method': 'backup',
                'code': backup_code,
            },
        )
        self.assertEqual(email_disabled.status_code, status.HTTP_200_OK, email_disabled.data)
        self.assertFalse(email_disabled.data['two_factor_enabled'])
        self.assertFalse(email_disabled.data['two_factor_backup_codes_enabled'])

    @patch('apps.accounts.services.two_factor.send_html_email')
    def test_employer_two_factor_email_uses_a_consistent_subject_and_targeted_content(
        self, send_email
    ):
        employer = User.objects.create_user(
            email='employer-email-copy@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            full_name='Lê Văn Hậu',
        )
        two_factor.issue_code(employer, two_factor.PURPOSE_DISABLE)

        two_factor.send_two_factor_email(employer, two_factor.PURPOSE_DISABLE, target='totp')

        self.assertTrue(send_email.called)
        payload = send_email.call_args.kwargs
        self.assertEqual(
            payload['subject'], '[ProCV] Mã xác thực 2 yếu tố cho tài khoản Nhà tuyển dụng'
        )
        self.assertIn('Kính gửi Quý khách hàng Lê Văn Hậu', payload['text'])
        self.assertIn(
            'Tắt xác thực 2 yếu tố sử dụng ứng dụng xác thực (Google Authenticator)',
            payload['html'],
        )

    def test_employer_backup_code_is_one_time_login_factor(self):
        employer = User.objects.create_user(
            email='employer-backup@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=employer)
        two_factor.issue_code(employer, two_factor.PURPOSE_SETUP)
        code = cache.get(two_factor._code_key(employer.pk, two_factor.PURPOSE_SETUP))
        confirmed = self.client.post(reverse('auth-two-factor-setup-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)
        backup_code = confirmed.data['backup_codes'][0]

        self.client.force_authenticate(user=None)
        login = self.client.post(
            reverse('auth-login'),
            {
                'email': employer.email,
                'password': 'Password@123',
                'captcha_token': 'x',
                'portal': 'employer',
            },
        )
        self.assertEqual(login.status_code, status.HTTP_202_ACCEPTED, login.data)
        verified = self.client.post(
            reverse('auth-two-factor-login-verify'),
            {
                'challenge': login.data['challenge'],
                'method': 'backup',
                'code': backup_code,
            },
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK, verified.data)

        replay = self.client.post(
            reverse('auth-two-factor-login-verify'),
            {
                'challenge': login.data['challenge'],
                'method': 'backup',
                'code': backup_code,
            },
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)
