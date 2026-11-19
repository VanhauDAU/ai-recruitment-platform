"""Song ngữ vi/en của accounts (ADR-0023): email theo người nhận, lỗi API theo request."""

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import AuthEmailJob, User
from ..services import email_verification
from ..tasks import deliver_auth_email_job, queue_auth_email


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class AccountsTranslationTests(APITestCase):
    def test_verification_email_uses_the_recipient_language(self):
        user = User.objects.create_user(
            email='en-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            full_name='Jane Doe',
            preferred_language=User.Language.EN,
        )

        email_verification.send_verification_email(user)

        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Verify your employer account at ProCV')
        self.assertIn('Dear Jane Doe - Employer ID', message.body)
        self.assertIn('Verify account', message.alternatives[0][0])
        self.assertNotIn('Xác thực', message.alternatives[0][0])

    def test_queued_email_renders_in_recipient_language_not_the_worker_language(self):
        english = User.objects.create_user(
            email='en@example.com', password='Password@123', preferred_language='en'
        )
        vietnamese = User.objects.create_user(
            email='vi@example.com', password='Password@123', preferred_language='vi'
        )
        jobs = [queue_auth_email(AuthEmailJob.Kind.VERIFICATION, u) for u in (english, vietnamese)]

        with self.settings(LANGUAGE_CODE='vi'):
            for job in jobs:
                deliver_auth_email_job.run(job.pk)

        subjects = {message.to[0]: message.subject for message in mail.outbox}
        self.assertEqual(subjects['en@example.com'], 'Verify your email address at ProCV')
        self.assertEqual(subjects['vi@example.com'], 'Xác thực địa chỉ email của bạn tại ProCV')

    def test_login_error_follows_accept_language(self):
        User.objects.create_user(email='login-en@example.com', password='Password@123')
        payload = {'email': 'login-en@example.com', 'password': 'wrong', 'captcha_token': 'x'}

        english = self.client.post(reverse('auth-login'), payload, HTTP_ACCEPT_LANGUAGE='en')
        vietnamese = self.client.post(reverse('auth-login'), payload, HTTP_ACCEPT_LANGUAGE='vi')

        self.assertEqual(english.status_code, status.HTTP_401_UNAUTHORIZED, english.data)
        self.assertEqual(
            str(english.data['detail']), 'Incorrect email or password. Please try again.'
        )
        self.assertEqual(
            str(vietnamese.data['detail']), 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.'
        )

    def test_invalid_verification_link_error_in_english(self):
        response = self.client.post(
            reverse('auth-verify-confirm'), {'token': 'missing'}, HTTP_ACCEPT_LANGUAGE='en'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data['detail']), 'The verification link is invalid or has expired.'
        )
