import logging

from celery import shared_task

from ..services import (
    claim_due_candidate_job_digest_candidates as claim_due_candidates_service,
)
from ..services import (
    deliver_candidate_job_digest as deliver_digest_service,
)
from ..services import (
    pending_candidate_job_digest_ids,
    release_candidate_job_digest_claim,
)
from ..services import (
    prepare_candidate_job_digest as prepare_candidate_digest_service,
)
from ..services import (
    purge_candidate_job_digest_history as purge_digest_history_service,
)

logger = logging.getLogger(__name__)


@shared_task(name='apps.jobs.tasks.prepare_due_candidate_job_digests')
def prepare_due_candidate_job_digests():
    claims = claim_due_candidates_service()
    for claim in claims:
        try:
            prepare_candidate_job_digest.delay(
                claim['candidate_id'],
                claim['claimed_at'],
            )
        except Exception:  # noqa: BLE001 - release makes the source due again
            release_candidate_job_digest_claim(
                claim['candidate_id'],
                claim['claimed_at'],
            )
            logger.exception('Không thể dispatch chuẩn bị job digest cho candidate.')
    return len(claims)


@shared_task(name='apps.jobs.tasks.prepare_candidate_job_digest')
def prepare_candidate_job_digest(candidate_id, claimed_at=None):
    digest = prepare_candidate_digest_service(
        candidate_id,
        now=claimed_at,
        claimed_at=claimed_at,
    )
    if digest and digest.status == 'pending':
        deliver_candidate_job_digest.delay(digest.pk)
        return digest.pk
    return None


@shared_task(
    bind=True,
    max_retries=3,
    name='apps.jobs.tasks.deliver_candidate_job_digest',
)
def deliver_candidate_job_digest(self, digest_id):
    try:
        return deliver_digest_service(digest_id)
    except Exception as error:  # noqa: BLE001 - SMTP/provider errors are retryable
        if self.request.retries >= self.max_retries:
            raise
        raise self.retry(
            exc=error,
            countdown=min(2 ** (self.request.retries + 1), 60),
        ) from error


@shared_task(name='apps.jobs.tasks.dispatch_pending_candidate_job_digests')
def dispatch_pending_candidate_job_digests():
    digest_ids = pending_candidate_job_digest_ids()
    for digest_id in digest_ids:
        try:
            deliver_candidate_job_digest.delay(digest_id)
        except Exception:  # noqa: BLE001 - leave row pending for the next sweep
            logger.exception('Không thể redispatch candidate job digest %s.', digest_id)
    return len(digest_ids)


@shared_task(name='apps.jobs.tasks.purge_candidate_job_digest_history')
def purge_candidate_job_digest_history():
    return purge_digest_history_service()
