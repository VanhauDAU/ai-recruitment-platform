import re
from datetime import timedelta
from io import StringIO
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import EmployerPhoneVerificationEvent, PhoneOtp, RecruiterProfile
from ..services.phone_challenges import (
    challenge_code_matches,
    create_sms_phone_challenge,
    dispatch_sms_phone_challenge,
    enqueue_sms_phone_challenge,
    hash_challenge_code,
    mark_sms_dispatch_retries_exhausted,
    normalize_vietnamese_mobile,
    purge_expired_phone_verification_events,
    purge_expired_sms_challenge_payloads,
    recover_stale_sms_dispatches,
)
from ..services.sms_provider import (
    FakeSmsProvider,
    HttpSmsProvider,
    SmsMessage,
    SmsProviderPermanentError,
    SmsProviderTemporaryError,
    sms_configuration_errors,
)
from ..tasks.phone_sms import dispatch_employer_sms_challenge

SMS_SETTINGS = {
    'EMPLOYER_SMS_OTP_ENABLED': True,
    'EMPLOYER_SMS_PROVIDER': 'fake',
    'EMPLOYER_SMS_SENDER': 'ProCV',
    'EMPLOYER_SMS_TEMPLATE_ID': 'employer-phone-otp-v1',
    'EMPLOYER_SMS_ENDPOINT_URL': '',
    'EMPLOYER_SMS_API_TOKEN': '',
    'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY': '',
    'EMPLOYER_SMS_CHALLENGE_HMAC_KEY': '',
    'EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS': 2.0,
    'EMPLOYER_SMS_READ_TIMEOUT_SECONDS': 5.0,
    'EMPLOYER_SMS_DISPATCH_STALE_SECONDS': 300,
    'EMPLOYER_SMS_CHALLENGE_RETENTION_DAYS': 30,
    'EMPLOYER_SMS_EVENT_RETENTION_DAYS': 730,
    'IS_PRODUCTION': False,
}
VALID_FERNET_KEY = 'MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA='


class SmsDeploymentConfigTests(SimpleTestCase):
    def test_compose_worker_consumes_every_configured_task_queue(self):
        compose_path = Path(__file__).resolve().parents[4] / 'docker-compose.yml'
        if not compose_path.exists():
            self.skipTest('Repository root is not mounted in this backend runtime.')
        compose = compose_path.read_text(encoding='utf-8')
        queue_arguments = re.findall(r'celery -A config worker[^\n]* -Q ([^\s]+)', compose)
        worker_queues = {
            queue for queue_argument in queue_arguments for queue in queue_argument.split(',')
        }
        routed_queues = {
            route['queue']
            for route in settings.CELERY_TASK_ROUTES.values()
            if isinstance(route, dict) and route.get('queue')
        }

        self.assertIn('auth-sms', worker_queues)
        self.assertTrue(routed_queues.issubset(worker_queues))


class VietnameseMobileNormalizationTests(TestCase):
    def test_accepts_local_and_canonical_mobile_forms(self):
        self.assertEqual(normalize_vietnamese_mobile('0912 345 678'), '+84912345678')
        self.assertEqual(normalize_vietnamese_mobile('+84-357-123-456'), '+84357123456')

    def test_rejects_landline_foreign_and_malformed_numbers(self):
        for value in ('02412345678', '+12025550123', '+841234', 'not-a-phone'):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                normalize_vietnamese_mobile(value)


@override_settings(**SMS_SETTINGS)
class SmsChallengeLifecycleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='sms-foundation@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )

    def _challenge(self, phone='0912345678'):
        return create_sms_phone_challenge(
            user=self.user,
            phone=phone,
            purpose=PhoneOtp.Purpose.INITIAL_VERIFICATION,
        )

    def test_challenge_persists_no_plaintext_phone_or_otp(self):
        challenge = self._challenge()

        self.assertEqual(challenge.phone, '')
        self.assertNotIn('0912345678', challenge.destination_ciphertext)
        self.assertNotIn('+84912345678', challenge.destination_ciphertext)
        self.assertTrue(challenge.otp_ciphertext)
        self.assertEqual(len(challenge.code_hash), 64)
        event = EmployerPhoneVerificationEvent.objects.get(
            challenge_public_id=challenge.public_id,
            event_type=EmployerPhoneVerificationEvent.EventType.CHALLENGE_CREATED,
        )
        self.assertNotIn('0912345678', str(event.__dict__))

    def test_hash_is_bound_to_challenge_and_constant_time_verifier_accepts_code(self):
        first = self._challenge()
        second_id = 'poc_secondchallenge'
        code = '123456'

        first.code_hash = hash_challenge_code(first.public_id, code)

        self.assertTrue(challenge_code_matches(first, code))
        self.assertFalse(challenge_code_matches(first, '654321'))
        self.assertNotEqual(first.code_hash, hash_challenge_code(second_id, code))

    def test_new_challenge_invalidates_previous_active_challenge(self):
        first = self._challenge()
        second = self._challenge('0987654321')

        first.refresh_from_db()
        self.assertIsNotNone(first.invalidated_at)
        self.assertEqual(first.invalidation_reason, 'superseded')
        self.assertEqual(first.otp_ciphertext, '')
        self.assertIsNotNone(first.secret_purged_at)
        self.assertIsNone(second.invalidated_at)
        self.assertTrue(
            EmployerPhoneVerificationEvent.objects.filter(
                challenge_public_id=first.public_id,
                event_type=EmployerPhoneVerificationEvent.EventType.CHALLENGE_INVALIDATED,
            ).exists()
        )

    def test_dispatch_uses_id_only_boundary_and_purges_otp_ciphertext(self):
        challenge = self._challenge()
        provider = FakeSmsProvider()

        with self.assertLogs('product.metrics', level='INFO') as metric_logs:
            dispatched = dispatch_sms_phone_challenge(challenge.public_id, provider=provider)

        self.assertEqual(dispatched.dispatch_status, PhoneOtp.DispatchStatus.SENT)
        self.assertEqual(len(provider.outbox), 1)
        message = provider.outbox[0]
        self.assertEqual(message.destination, '+84912345678')
        self.assertRegex(message.template_parameters['code'], r'^\d{6}$')
        self.assertEqual(message.idempotency_key, challenge.public_id)
        challenge.refresh_from_db()
        self.assertEqual(challenge.otp_ciphertext, '')
        self.assertIsNotNone(challenge.secret_purged_at)
        rendered_logs = '\n'.join(metric_logs.output)
        self.assertNotIn(message.destination, rendered_logs)
        self.assertNotIn(message.template_parameters['code'], rendered_logs)

    def test_enqueue_passes_only_public_challenge_id_to_celery(self):
        challenge = self._challenge()

        with patch('apps.employers.services.phone_challenges.current_app.send_task') as send_task:
            with self.captureOnCommitCallbacks(execute=True):
                enqueue_sms_phone_challenge(challenge)

        send_task.assert_called_once_with(
            'apps.employers.tasks.phone_sms.dispatch_employer_sms_challenge',
            args=[challenge.public_id],
        )
        broker_arguments = str(send_task.call_args)
        self.assertNotIn('0912345678', broker_arguments)
        self.assertNotIn('+84912345678', broker_arguments)

    def test_temporary_error_becomes_terminal_after_retry_budget(self):
        challenge = self._challenge()
        provider = Mock()
        provider.send.side_effect = SmsProviderTemporaryError()

        with self.assertRaises(SmsProviderTemporaryError):
            dispatch_sms_phone_challenge(challenge.public_id, provider=provider)
        dispatched_message = provider.send.call_args.args[0]
        challenge.refresh_from_db()
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.RETRY_PENDING)

        with self.assertLogs('product.metrics', level='INFO') as metric_logs:
            mark_sms_dispatch_retries_exhausted(challenge.public_id)
        challenge.refresh_from_db()
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.FAILED)
        self.assertEqual(challenge.dispatch_error_code, 'provider_retries_exhausted')
        self.assertEqual(challenge.otp_ciphertext, '')
        terminal_event = EmployerPhoneVerificationEvent.objects.get(
            challenge_public_id=challenge.public_id,
            event_type=EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED,
            reason_code='provider_retries_exhausted',
        )
        redacted_evidence = f'{terminal_event.__dict__}\n{" ".join(metric_logs.output)}'
        self.assertNotIn(dispatched_message.destination, redacted_evidence)
        self.assertNotIn(dispatched_message.template_parameters['code'], redacted_evidence)

        second_provider = Mock()
        self.assertIsNone(
            dispatch_sms_phone_challenge(challenge.public_id, provider=second_provider)
        )
        second_provider.send.assert_not_called()

    def test_worker_last_retry_marks_terminal_without_logging_secret(self):
        challenge = self._challenge()
        phone = '+84912345678'
        code = '123456'

        with (
            patch(
                'apps.employers.tasks.phone_sms.dispatch_sms_phone_challenge',
                side_effect=SmsProviderTemporaryError(),
            ),
            patch(
                'apps.employers.tasks.phone_sms.mark_sms_dispatch_retries_exhausted'
            ) as exhausted,
        ):
            dispatch_employer_sms_challenge.push_request(
                retries=dispatch_employer_sms_challenge.max_retries
            )
            try:
                result = dispatch_employer_sms_challenge.run(challenge.public_id)
            finally:
                dispatch_employer_sms_challenge.pop_request()

        exhausted.assert_called_once_with(challenge.public_id)
        self.assertEqual(result['reason_code'], 'provider_retries_exhausted')
        self.assertNotIn(phone, str(result))
        self.assertNotIn(code, str(result))

    def test_disabled_provider_fails_closed_without_email_fallback(self):
        challenge = self._challenge()

        with override_settings(EMPLOYER_SMS_OTP_ENABLED=False):
            with self.assertLogs('apps.employers.tasks.phone_sms', level='WARNING') as logs:
                result = dispatch_employer_sms_challenge.run(challenge.public_id)

        challenge.refresh_from_db()
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.DISABLED)
        self.assertEqual(challenge.otp_ciphertext, '')
        self.assertEqual(result['reason_code'], 'provider_disabled')
        output = '\n'.join(logs.output)
        self.assertNotIn('0912345678', output)
        self.assertNotIn('+84912345678', output)

    def test_stale_dispatch_recovery_is_bounded_and_retryable(self):
        challenge = self._challenge()
        challenge.dispatch_status = PhoneOtp.DispatchStatus.DISPATCHING
        challenge.dispatch_started_at = timezone.now() - timedelta(minutes=10)
        challenge.save(update_fields=['dispatch_status', 'dispatch_started_at', 'updated_at'])

        recovered = recover_stale_sms_dispatches(limit=1)

        self.assertEqual(recovered, [challenge.public_id])
        challenge.refresh_from_db()
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.RETRY_PENDING)
        self.assertEqual(challenge.dispatch_error_code, 'dispatch_stale')

    def test_stale_recovery_cannot_reset_the_global_dispatch_attempt_budget(self):
        challenge = self._challenge()
        challenge.dispatch_status = PhoneOtp.DispatchStatus.DISPATCHING
        challenge.dispatch_attempts = 4
        challenge.dispatch_started_at = timezone.now() - timedelta(minutes=10)
        challenge.save(
            update_fields=[
                'dispatch_status',
                'dispatch_attempts',
                'dispatch_started_at',
                'updated_at',
            ]
        )

        self.assertEqual(recover_stale_sms_dispatches(limit=1), [])
        challenge.refresh_from_db()
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.FAILED)
        self.assertEqual(challenge.dispatch_error_code, 'dispatch_attempt_budget_exhausted')
        self.assertEqual(challenge.otp_ciphertext, '')

    def test_retention_purges_challenge_payload_after_30_days_and_events_after_24_months(self):
        challenge = self._challenge()
        PhoneOtp.objects.filter(pk=challenge.pk).update(
            created_at=timezone.now() - timedelta(days=31)
        )
        old_event = EmployerPhoneVerificationEvent.objects.create(
            user=self.user,
            challenge_public_id='poc_old_event',
            purpose=PhoneOtp.Purpose.REVERIFY,
            event_type=EmployerPhoneVerificationEvent.EventType.VERIFIED,
            outcome='verified',
        )
        EmployerPhoneVerificationEvent.objects.filter(pk=old_event.pk).update(
            occurred_at=timezone.now() - timedelta(days=731)
        )

        self.assertEqual(purge_expired_sms_challenge_payloads(limit=1), 1)
        challenge.refresh_from_db()
        self.assertEqual(challenge.phone, '')
        self.assertEqual(challenge.phone_fingerprint, '')
        self.assertEqual(challenge.destination_ciphertext, '')
        self.assertEqual(challenge.otp_ciphertext, '')
        self.assertEqual(challenge.code_hash, '')
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.PURGED)
        self.assertIsNotNone(challenge.pii_purged_at)

        self.assertEqual(purge_expired_phone_verification_events(limit=10), 1)
        self.assertFalse(EmployerPhoneVerificationEvent.objects.filter(pk=old_event.pk).exists())

    def test_redacted_event_is_immutable_through_model_api(self):
        challenge = self._challenge()
        event = EmployerPhoneVerificationEvent.objects.filter(
            challenge_public_id=challenge.public_id
        ).first()
        event.reason_code = 'mutated'

        with self.assertRaises(ValidationError):
            event.save()

    def test_new_unverified_profile_uses_null_without_touching_existing_phone_proof(self):
        profile = RecruiterProfile.objects.create(user=self.user)
        self.assertIsNone(profile.verified_phone)
        self.assertIsNone(profile.phone_verified_at)


@override_settings(**SMS_SETTINGS)
class SmsLiveWorkflowApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='sms-live@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.profile = RecruiterProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def _start(self, phone='0912345678'):
        with (
            patch(
                'apps.employers.services.phone_challenges.secrets.randbelow', return_value=123456
            ),
            patch('apps.employers.services.phone_challenges.current_app.send_task') as send_task,
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': phone, 'password': 'Password@123'},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED, response.data)
        send_task.assert_called_once()
        challenge = PhoneOtp.objects.get(public_id=response.data['public_id'])
        dispatch_sms_phone_challenge(challenge.public_id, provider=FakeSmsProvider())
        return challenge

    def test_initial_sms_is_actor_bound_and_verifies_exact_challenge(self):
        challenge = self._start()

        status_response = self.client.get(
            reverse('employer-phone-challenge', args=[challenge.public_id])
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertEqual(status_response.data['status'], PhoneOtp.DispatchStatus.SENT)
        self.assertTrue(status_response.data['can_verify'])
        self.assertNotIn('phone', status_response.data)

        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': challenge.public_id, 'code': '123456'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.profile.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.profile.verified_phone, '+84912345678')
        self.assertEqual(self.user.phone, '+84912345678')
        challenge.refresh_from_db()
        self.assertEqual(challenge.dispatch_status, PhoneOtp.DispatchStatus.VERIFIED)
        self.assertTrue(
            EmployerPhoneVerificationEvent.objects.filter(
                challenge_public_id=challenge.public_id,
                event_type=EmployerPhoneVerificationEvent.EventType.VERIFIED,
            ).exists()
        )
        replay = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': challenge.public_id, 'code': '123456'},
            format='json',
        )
        self.assertEqual(replay.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(replay.data['code'], 'PHONE_CHALLENGE_USED')

    def test_phone_change_preserves_old_proof_until_new_code_succeeds(self):
        self.profile.verified_phone = '+84911111111'
        self.profile.contact_phone = '+84911111111'
        self.profile.phone_verified_at = timezone.now()
        self.profile.save(
            update_fields=['verified_phone', 'contact_phone', 'phone_verified_at', 'updated_at']
        )
        self.user.phone = '+84911111111'
        self.user.save(update_fields=['phone', 'updated_at'])

        challenge = self._start('0987654321')
        self.profile.refresh_from_db()
        self.assertEqual(challenge.purpose, PhoneOtp.Purpose.PHONE_CHANGE)
        self.assertEqual(self.profile.verified_phone, '+84911111111')

        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': challenge.public_id, 'code': '123456'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.verified_phone, '+84987654321')

    def test_availability_is_generic_and_challenge_is_not_visible_to_other_actor(self):
        other = User.objects.create_user(
            email='sms-other@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(
            user=other,
            verified_phone='+84912345678',
            phone_verified_at=timezone.now(),
        )
        availability = self.client.get(
            reverse('employer-phone-check'),
            {'phone': '0912345678'},
        )
        self.assertEqual(availability.status_code, status.HTTP_200_OK)
        self.assertEqual(availability.data, {'available': True})

        challenge = self._start('0987654321')
        self.client.force_authenticate(user=other)
        response = self.client.get(reverse('employer-phone-challenge', args=[challenge.public_id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_disabled_sms_fails_closed_without_creating_legacy_email_otp(self):
        with override_settings(EMPLOYER_SMS_OTP_ENABLED=False):
            response = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': '0912345678', 'password': 'Password@123'},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['code'], 'PHONE_SMS_DISABLED')
        self.assertFalse(PhoneOtp.objects.filter(user=self.user).exists())

    def test_resend_cooldown_and_verify_attempt_budget_are_enforced(self):
        challenge = self._start()
        with patch('apps.employers.services.phone_challenges.current_app.send_task'):
            resend = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': '0912345678', 'password': 'Password@123'},
                format='json',
            )
        self.assertEqual(resend.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(resend.data['code'], 'PHONE_OTP_COOLDOWN')
        self.assertGreater(resend.data['retry_after_seconds'], 0)

        for _ in range(5):
            invalid = self.client.post(
                reverse('employer-phone-verify'),
                {'challenge_id': challenge.public_id, 'code': '000000'},
                format='json',
            )
            self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 5)
        self.assertEqual(challenge.invalidation_reason, 'verify_attempts_exhausted')


class HttpSmsProviderTests(TestCase):
    message = SmsMessage(
        destination='+84912345678',
        template_id='template-v1',
        template_parameters={'code': '123456', 'ttl_minutes': '10'},
        sender='ProCV',
        idempotency_key='poc_http_test',
    )

    @override_settings(
        EMPLOYER_SMS_ENDPOINT_URL='https://sms-gateway.example.test/v1/messages',
        EMPLOYER_SMS_API_TOKEN='test-api-token',
        EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS=2,
        EMPLOYER_SMS_READ_TIMEOUT_SECONDS=5,
    )
    def test_http_adapter_sends_generic_contract_and_idempotency_key(self):
        response = Mock(status_code=202)
        response.json.return_value = {'message_id': 'provider-message-123'}
        session = Mock()
        session.post.return_value = response

        receipt = HttpSmsProvider(session=session).send(self.message)

        self.assertEqual(receipt.message_id, 'provider-message-123')
        request = session.post.call_args
        self.assertEqual(request.kwargs['headers']['Idempotency-Key'], 'poc_http_test')
        self.assertEqual(request.kwargs['json']['to'], '+84912345678')
        self.assertFalse(request.kwargs['allow_redirects'])
        self.assertNotIn('test-api-token', str(receipt))

    @override_settings(
        EMPLOYER_SMS_ENDPOINT_URL='https://sms-gateway.example.test/v1/messages',
        EMPLOYER_SMS_API_TOKEN='test-api-token',
        EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS=2,
        EMPLOYER_SMS_READ_TIMEOUT_SECONDS=5,
    )
    def test_http_adapter_classifies_outage_and_rejection_without_response_body(self):
        session = Mock()
        session.post.side_effect = requests.Timeout('raw destination +84912345678')
        with self.assertRaises(SmsProviderTemporaryError) as temporary:
            HttpSmsProvider(session=session).send(self.message)
        self.assertEqual(str(temporary.exception), 'provider_unavailable')
        self.assertNotIn('+84912345678', str(temporary.exception))

        response = Mock(status_code=400, text='invalid phone +84912345678 code 123456')
        session.post.side_effect = None
        session.post.return_value = response
        with self.assertRaises(SmsProviderPermanentError) as permanent:
            HttpSmsProvider(session=session).send(self.message)
        self.assertEqual(str(permanent.exception), 'provider_rejected')
        self.assertNotIn('+84912345678', str(permanent.exception))
        self.assertNotIn('123456', str(permanent.exception))


class SmsReadinessTests(TestCase):
    def test_disabled_readiness_is_explicit_and_require_enabled_fails(self):
        output = StringIO()
        with override_settings(EMPLOYER_SMS_OTP_ENABLED=False):
            call_command('check_employer_sms_readiness', stdout=output)
            with self.assertRaises(CommandError):
                call_command('check_employer_sms_readiness', '--require-enabled')
        self.assertIn('DISABLED', output.getvalue())

    @override_settings(**SMS_SETTINGS)
    def test_fake_provider_is_ready_only_outside_production(self):
        self.assertEqual(sms_configuration_errors(require_enabled=True), [])
        with override_settings(IS_PRODUCTION=True):
            errors = sms_configuration_errors(require_enabled=True)
        self.assertTrue(any('Production' in error for error in errors))

    @override_settings(
        **{
            **SMS_SETTINGS,
            'EMPLOYER_SMS_PROVIDER': 'http',
            'EMPLOYER_SMS_ENDPOINT_URL': '',
            'EMPLOYER_SMS_API_TOKEN': '',
        }
    )
    def test_enabled_http_provider_reports_missing_configuration(self):
        errors = sms_configuration_errors(require_enabled=True)
        self.assertTrue(any('ENDPOINT_URL' in error for error in errors))
        self.assertTrue(any('API_TOKEN' in error for error in errors))

    def test_production_rejects_reused_hmac_and_payload_secrets(self):
        jwt_signing_key = 'distinct-jwt-signing-key-at-least-32-characters'
        ready_settings = {
            **SMS_SETTINGS,
            'IS_PRODUCTION': True,
            'EMPLOYER_SMS_PROVIDER': 'http',
            'EMPLOYER_SMS_ENDPOINT_URL': 'https://sms-gateway.example.test/v1/messages',
            'EMPLOYER_SMS_API_TOKEN': 'provider-token',
            'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY': VALID_FERNET_KEY,
            'EMPLOYER_SMS_CHALLENGE_HMAC_KEY': 'distinct-hmac-key-at-least-32-characters',
            'TWO_FACTOR_TOTP_ENCRYPTION_KEY': 'distinct-totp-key',
            'SIMPLE_JWT': {**settings.SIMPLE_JWT, 'SIGNING_KEY': jwt_signing_key},
        }

        for reused_hmac_key in (settings.SECRET_KEY, jwt_signing_key):
            with self.subTest(reused_hmac_key=reused_hmac_key):
                with override_settings(
                    **{
                        **ready_settings,
                        'EMPLOYER_SMS_CHALLENGE_HMAC_KEY': reused_hmac_key,
                    }
                ):
                    errors = sms_configuration_errors(require_enabled=True)
                self.assertTrue(any('HMAC_KEY không được dùng lại' in error for error in errors))

        with override_settings(
            **{
                **ready_settings,
                'TWO_FACTOR_TOTP_ENCRYPTION_KEY': VALID_FERNET_KEY,
            }
        ):
            errors = sms_configuration_errors(require_enabled=True)
        self.assertTrue(
            any('PAYLOAD_ENCRYPTION_KEY không được dùng lại' in error for error in errors)
        )
