"""Provider dispatch of queued challenges: claim, send, retry and stale recovery."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from common.metrics import record_metric

from ...models import EmployerPhoneVerificationEvent, PhoneOtp
from ..sms_provider import (
    SmsMessage,
    SmsProviderDisabled,
    SmsProviderError,
    get_sms_provider,
)
from .challenges import SMS_OTP_TTL, append_event
from .crypto import decrypt_payload

SMS_MAX_DISPATCH_ATTEMPTS = 4


@transaction.atomic
def _claim_dispatch(challenge_public_id):
    challenge = PhoneOtp.objects.select_for_update().filter(public_id=challenge_public_id).first()
    if challenge is None:
        return None
    if challenge.invalidated_at or challenge.verified_at or challenge.expires_at <= timezone.now():
        return None
    if challenge.dispatch_status not in {
        PhoneOtp.DispatchStatus.QUEUED,
        PhoneOtp.DispatchStatus.RETRY_PENDING,
    }:
        return None
    if challenge.dispatch_attempts >= SMS_MAX_DISPATCH_ATTEMPTS:
        challenge.dispatch_status = PhoneOtp.DispatchStatus.FAILED
        challenge.dispatch_error_code = 'dispatch_attempt_budget_exhausted'
        challenge.otp_ciphertext = ''
        challenge.secret_purged_at = timezone.now()
        challenge.save(
            update_fields=[
                'dispatch_status',
                'dispatch_error_code',
                'otp_ciphertext',
                'secret_purged_at',
                'updated_at',
            ]
        )
        append_event(
            challenge,
            EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED,
            outcome='failed',
            reason_code='dispatch_attempt_budget_exhausted',
        )
        record_metric(
            'employer_sms_dispatch',
            status='failed',
            failure_code='dispatch_attempt_budget_exhausted',
            purpose=challenge.purpose,
        )
        return None
    now = timezone.now()
    challenge.dispatch_status = PhoneOtp.DispatchStatus.DISPATCHING
    challenge.dispatch_attempts += 1
    challenge.dispatch_started_at = now
    challenge.dispatch_error_code = ''
    challenge.save(
        update_fields=[
            'dispatch_status',
            'dispatch_attempts',
            'dispatch_started_at',
            'dispatch_error_code',
            'updated_at',
        ]
    )
    append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.DISPATCH_STARTED,
        outcome='dispatching',
    )
    return challenge


@transaction.atomic
def _mark_dispatch_error(challenge_public_id, error):
    challenge = PhoneOtp.objects.select_for_update().get(public_id=challenge_public_id)
    if challenge.dispatch_status != PhoneOtp.DispatchStatus.DISPATCHING:
        return challenge
    retryable = bool(error.retryable)
    if isinstance(error, SmsProviderDisabled):
        status = PhoneOtp.DispatchStatus.DISABLED
        event_type = EmployerPhoneVerificationEvent.EventType.DISPATCH_DISABLED
    elif retryable:
        status = PhoneOtp.DispatchStatus.RETRY_PENDING
        event_type = EmployerPhoneVerificationEvent.EventType.DISPATCH_RETRY
    else:
        status = PhoneOtp.DispatchStatus.FAILED
        event_type = EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED
    challenge.dispatch_status = status
    challenge.dispatch_error_code = error.reason_code
    update_fields = ['dispatch_status', 'dispatch_error_code', 'updated_at']
    if status != PhoneOtp.DispatchStatus.RETRY_PENDING:
        challenge.otp_ciphertext = ''
        challenge.secret_purged_at = timezone.now()
        update_fields.extend(['otp_ciphertext', 'secret_purged_at'])
    challenge.save(update_fields=update_fields)
    append_event(
        challenge,
        event_type,
        outcome=status,
        reason_code=error.reason_code,
    )
    record_metric(
        'employer_sms_dispatch',
        status=status,
        failure_code=error.reason_code,
        purpose=challenge.purpose,
    )
    return challenge


@transaction.atomic
def _mark_dispatch_sent(challenge_public_id, receipt):
    challenge = PhoneOtp.objects.select_for_update().get(public_id=challenge_public_id)
    if challenge.dispatch_status != PhoneOtp.DispatchStatus.DISPATCHING:
        return challenge
    now = timezone.now()
    challenge.dispatch_status = PhoneOtp.DispatchStatus.SENT
    challenge.dispatched_at = now
    challenge.provider_message_id = receipt.message_id[:255]
    challenge.dispatch_error_code = ''
    challenge.otp_ciphertext = ''
    challenge.secret_purged_at = now
    challenge.save(
        update_fields=[
            'dispatch_status',
            'dispatched_at',
            'provider_message_id',
            'dispatch_error_code',
            'otp_ciphertext',
            'secret_purged_at',
            'updated_at',
        ]
    )
    append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.DISPATCH_SENT,
        outcome='sent',
    )
    record_metric(
        'employer_sms_dispatch',
        status='sent',
        purpose=challenge.purpose,
    )
    return challenge


def dispatch_sms_phone_challenge(challenge_public_id, *, provider=None):
    """Dispatch exactly one claimed challenge with provider-side idempotency."""

    challenge = _claim_dispatch(challenge_public_id)
    if challenge is None:
        return None
    try:
        provider = provider or get_sms_provider()
        receipt = provider.send(
            SmsMessage(
                destination=decrypt_payload(challenge.destination_ciphertext),
                template_id=settings.EMPLOYER_SMS_TEMPLATE_ID,
                template_parameters={
                    'code': decrypt_payload(challenge.otp_ciphertext),
                    'ttl_minutes': str(int(SMS_OTP_TTL.total_seconds() // 60)),
                },
                sender=settings.EMPLOYER_SMS_SENDER,
                idempotency_key=challenge.public_id,
            )
        )
    except SmsProviderError as error:
        _mark_dispatch_error(challenge.public_id, error)
        raise
    return _mark_dispatch_sent(challenge.public_id, receipt)


@transaction.atomic
def mark_sms_dispatch_retries_exhausted(challenge_public_id):
    """Move a retryable challenge to a durable terminal state."""

    challenge = PhoneOtp.objects.select_for_update().filter(public_id=challenge_public_id).first()
    if challenge is None or challenge.dispatch_status != PhoneOtp.DispatchStatus.RETRY_PENDING:
        return challenge
    challenge.dispatch_status = PhoneOtp.DispatchStatus.FAILED
    challenge.dispatch_error_code = 'provider_retries_exhausted'
    challenge.otp_ciphertext = ''
    challenge.secret_purged_at = timezone.now()
    challenge.save(
        update_fields=[
            'dispatch_status',
            'dispatch_error_code',
            'otp_ciphertext',
            'secret_purged_at',
            'updated_at',
        ]
    )
    append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED,
        outcome='failed',
        reason_code='provider_retries_exhausted',
    )
    record_metric(
        'employer_sms_dispatch',
        status='failed',
        failure_code='provider_retries_exhausted',
        purpose=challenge.purpose,
    )
    return challenge


@transaction.atomic
def recover_stale_sms_dispatches(*, limit=100):
    cutoff = timezone.now() - timedelta(seconds=settings.EMPLOYER_SMS_DISPATCH_STALE_SECONDS)
    stale = list(
        PhoneOtp.objects.select_for_update(skip_locked=True)
        .filter(
            dispatch_status=PhoneOtp.DispatchStatus.DISPATCHING,
            dispatch_started_at__lte=cutoff,
            invalidated_at__isnull=True,
            verified_at__isnull=True,
        )
        .order_by('dispatch_started_at')[:limit]
    )
    for challenge in stale:
        exhausted = challenge.dispatch_attempts >= SMS_MAX_DISPATCH_ATTEMPTS
        challenge.dispatch_status = (
            PhoneOtp.DispatchStatus.FAILED if exhausted else PhoneOtp.DispatchStatus.RETRY_PENDING
        )
        challenge.dispatch_error_code = (
            'dispatch_attempt_budget_exhausted' if exhausted else 'dispatch_stale'
        )
        update_fields = ['dispatch_status', 'dispatch_error_code', 'updated_at']
        if exhausted:
            challenge.otp_ciphertext = ''
            challenge.secret_purged_at = timezone.now()
            update_fields.extend(['otp_ciphertext', 'secret_purged_at'])
        challenge.save(update_fields=update_fields)
        append_event(
            challenge,
            EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED
            if exhausted
            else EmployerPhoneVerificationEvent.EventType.STALE_RECOVERED,
            outcome='failed' if exhausted else 'retry_pending',
            reason_code=challenge.dispatch_error_code,
        )
    retry_ids = [
        challenge.public_id
        for challenge in stale
        if challenge.dispatch_status == PhoneOtp.DispatchStatus.RETRY_PENDING
    ]
    exhausted_count = len(stale) - len(retry_ids)
    if retry_ids:
        record_metric('employer_sms_recovery', value=len(retry_ids), status='recovered')
    if exhausted_count:
        record_metric(
            'employer_sms_recovery',
            value=exhausted_count,
            status='failed',
            failure_code='dispatch_attempt_budget_exhausted',
        )
    return retry_ids
