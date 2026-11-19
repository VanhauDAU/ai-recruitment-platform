"""Retention jobs: purge challenge secrets/PII and expire the audit events."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from common.metrics import record_metric

from ...models import EmployerPhoneVerificationEvent, PhoneOtp
from .challenges import append_event


@transaction.atomic
def purge_expired_sms_challenge_payloads(*, limit=500):
    cutoff = timezone.now() - timedelta(days=settings.EMPLOYER_SMS_CHALLENGE_RETENTION_DAYS)
    challenges = list(
        PhoneOtp.objects.select_for_update(skip_locked=True)
        .filter(created_at__lte=cutoff, pii_purged_at__isnull=True)
        .order_by('created_at')[:limit]
    )
    now = timezone.now()
    for challenge in challenges:
        challenge.phone_fingerprint = ''
        challenge.destination_ciphertext = ''
        challenge.otp_ciphertext = ''
        challenge.code_hash = ''
        challenge.provider_message_id = ''
        challenge.pii_purged_at = now
        challenge.secret_purged_at = challenge.secret_purged_at or now
        challenge.dispatch_status = PhoneOtp.DispatchStatus.PURGED
        challenge.save(
            update_fields=[
                'phone_fingerprint',
                'destination_ciphertext',
                'otp_ciphertext',
                'code_hash',
                'provider_message_id',
                'pii_purged_at',
                'secret_purged_at',
                'dispatch_status',
                'updated_at',
            ]
        )
        append_event(
            challenge,
            EmployerPhoneVerificationEvent.EventType.PAYLOAD_PURGED,
            outcome='purged',
        )
    if challenges:
        record_metric('employer_sms_retention', value=len(challenges), status='payload_purged')
    return len(challenges)


def purge_expired_phone_verification_events(*, limit=1000):
    cutoff = timezone.now() - timedelta(days=settings.EMPLOYER_SMS_EVENT_RETENTION_DAYS)
    event_ids = list(
        EmployerPhoneVerificationEvent.objects.filter(occurred_at__lte=cutoff)
        .order_by('occurred_at')
        .values_list('pk', flat=True)[:limit]
    )
    if not event_ids:
        return 0
    deleted, _ = EmployerPhoneVerificationEvent.objects.filter(pk__in=event_ids).delete()
    record_metric('employer_sms_retention', value=deleted, status='events_deleted')
    return deleted
