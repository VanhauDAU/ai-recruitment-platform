"""Phone OTP endpoints and the console SMS provider."""

from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import (
    Company,
    CompanyDocument,
    EmployerVerificationCase,
    PhoneOtp,
    RecruiterProfile,
)
from ..services.phone_challenges import dispatch_sms_phone_challenge
from ..services.sms_provider import (
    ConsoleSmsProvider,
    FakeSmsProvider,
    SmsMessage,
    get_sms_provider,
    sms_configuration_errors,
)
from .factories import (
    make_recruiter,
)


@override_settings(
    EMPLOYER_SMS_OTP_ENABLED=True,
    EMPLOYER_SMS_PROVIDER='fake',
    EMPLOYER_SMS_SENDER='ProCV',
    EMPLOYER_SMS_TEMPLATE_ID='employer-phone-otp-v1',
    IS_PRODUCTION=False,
)
class PhoneOtpTests(APITestCase):
    def setUp(self):
        # The SMS boundary intentionally composes account and trusted-IP
        # throttles. LocMem cache outlives each rolled-back APITestCase method,
        # so isolate rate-limit buckets just like the registration tests do.
        cache.clear()
        self.user, self.recruiter = make_recruiter(phone_verified=False)
        self.client.force_authenticate(user=self.user)

    def _send_otp(self, phone='0912345678', password='Password@123'):
        with (
            patch(
                'apps.employers.services.phone_challenges.challenges.secrets.randbelow',
                return_value=123456,
            ),
            patch('apps.employers.services.phone_challenges.challenges.current_app.send_task'),
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': phone, 'password': password},
            )
        if response.status_code == status.HTTP_202_ACCEPTED:
            self.challenge_id = response.data['public_id']
            dispatch_sms_phone_challenge(self.challenge_id, provider=FakeSmsProvider())
        return response

    def test_send_and_verify_otp_marks_phone_verified(self):
        response = self._send_otp()
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '123456'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.verified_phone, '+84912345678')
        self.assertIsNotNone(self.recruiter.phone_verified_at)

    def test_verifying_phone_last_does_not_auto_approve_recruiter_case(self):
        now = timezone.now()
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified', 'updated_at'])
        company = Company.objects.create(
            company_name='Công ty hoàn tất điện thoại sau cùng',
            tax_code='0109876543',
            created_by=self.user,
        )
        self.recruiter.company = company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.registration_completed_at = now
        self.recruiter.dpa_accepted_at = now
        self.recruiter.save(
            update_fields=[
                'company',
                'company_role',
                'registration_completed_at',
                'dpa_accepted_at',
                'updated_at',
            ]
        )
        verification_case = EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=company,
            verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
            status=EmployerVerificationCase.Status.IN_REVIEW,
            submitted_at=now,
            review_started_at=now,
        )
        for index, doc_type in enumerate(
            (
                CompanyDocument.DocType.BUSINESS_REGISTRATION,
                CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            ),
            start=1,
        ):
            CompanyDocument.objects.create(
                company=company,
                recruiter=self.recruiter,
                uploaded_by=self.user,
                verification_case=verification_case,
                doc_type=doc_type,
                file_url=f'employers/reconcile/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                mime_type='application/pdf',
                file_size=1024,
                sha256=f'{index:064x}',
                status=CompanyDocument.Status.APPROVED,
                reviewed_at=now,
            )

        self._send_otp()
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '123456'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        verification_case.refresh_from_db()
        self.assertEqual(verification_case.status, EmployerVerificationCase.Status.IN_REVIEW)

    def test_sms_dispatch_is_deferred_until_commit(self):
        """Challenge ID only enters the broker after the database commit."""
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            response = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': '0912345678', 'password': 'Password@123'},
            )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(callbacks), 1)

    def test_wrong_otp_rejected_and_attempts_counted(self):
        self._send_otp()
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '000000'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PhoneOtp.objects.get(user=self.user).attempts, 1)

    def test_phone_already_verified_by_other_recruiter_is_rejected(self):
        other_user, other = make_recruiter('other@example.com', phone_verified=False)
        other.verified_phone = '0912345678'
        other.phone_verified_at = timezone.now()
        other.save()

        self._send_otp()
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '123456'},
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'PHONE_UNAVAILABLE')

    def test_send_otp_rejects_wrong_password(self):
        response = self._send_otp(password='Wrong@123')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'PHONE_REAUTH_FAILED')

    def test_send_otp_requires_password(self):
        response = self.client.post(reverse('employer-phone-send-otp'), {'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'PHONE_REAUTH_FAILED')

    def test_oauth_account_without_password_must_create_password_first(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=['password', 'updated_at'])

        response = self._send_otp()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'PHONE_REAUTH_REQUIRED')


class ConsoleSmsProviderTests(SimpleTestCase):
    @override_settings(EMPLOYER_SMS_OTP_ENABLED=True, EMPLOYER_SMS_PROVIDER='console')
    def test_development_provider_writes_the_code_to_the_log(self):
        provider = get_sms_provider()
        message = SmsMessage(
            destination='0900000000',
            template_id='',
            template_parameters={'code': '482915', 'ttl_minutes': '10'},
            sender='',
            idempotency_key='sms_1',
        )

        with self.assertLogs('apps.employers.services.sms_provider', level='WARNING') as logs:
            receipt = provider.send(message)

        self.assertIsInstance(provider, ConsoleSmsProvider)
        self.assertIn('code=482915', logs.output[0])
        self.assertEqual(receipt.message_id, 'console-sms_1')

    @override_settings(
        EMPLOYER_SMS_OTP_ENABLED=True, EMPLOYER_SMS_PROVIDER='console', IS_PRODUCTION=True
    )
    def test_production_refuses_the_console_provider(self):
        self.assertIn(
            'Production chỉ cho phép EMPLOYER_SMS_PROVIDER=http hoặc speedsms.',
            sms_configuration_errors(require_enabled=True),
        )
