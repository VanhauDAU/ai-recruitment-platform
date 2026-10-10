"""Celery entry points for provider-neutral employer SMS dispatch and retention."""

import logging

from celery import shared_task

from ..services.phone_challenges import (
    dispatch_sms_phone_challenge,
    mark_sms_dispatch_retries_exhausted,
    purge_expired_phone_verification_events,
    purge_expired_sms_challenge_payloads,
    recover_stale_sms_dispatches,
)
from ..services.sms_provider import SmsProviderError

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def dispatch_employer_sms_challenge(self, challenge_public_id):
    """Dispatch by opaque ID only; phone and OTP never enter broker arguments."""

    try:
        challenge = dispatch_sms_phone_challenge(challenge_public_id)
    except SmsProviderError as error:
        if error.retryable:
            if self.request.retries >= self.max_retries:
                mark_sms_dispatch_retries_exhausted(challenge_public_id)
                return {
                    'status': 'failed',
                    'reason_code': 'provider_retries_exhausted',
                }
            countdown = 30 * (2**self.request.retries)
            raise self.retry(exc=error, countdown=countdown) from error
        logger.warning(
            'Employer SMS dispatch stopped.',
            extra={
                'challenge_public_id': challenge_public_id,
                'failure_code': error.reason_code,
            },
        )
        return {'status': 'failed', 'reason_code': error.reason_code}
    if challenge is None:
        return {'status': 'ignored'}
    return {'status': challenge.dispatch_status}


@shared_task
def recover_stale_employer_sms_dispatches(limit=100):
    challenge_ids = recover_stale_sms_dispatches(limit=limit)
    for challenge_public_id in challenge_ids:
        dispatch_employer_sms_challenge.delay(challenge_public_id)
    return len(challenge_ids)


@shared_task
def purge_employer_sms_verification_data(challenge_limit=500, event_limit=1000):
    return {
        'challenge_payloads_purged': purge_expired_sms_challenge_payloads(limit=challenge_limit),
        'events_deleted': purge_expired_phone_verification_events(limit=event_limit),
    }
