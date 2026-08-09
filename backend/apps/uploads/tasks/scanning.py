"""Durable Celery orchestration for shared quarantine scanning and cleanup."""

import logging

from celery import shared_task
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from apps.uploads.models import UploadSession, UploadState
from apps.uploads.services import (
    cleanup_upload_objects,
    expire_stale_upload_sessions,
    process_upload_scan,
    purge_expired_upload_evidence,
)

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=None,
    soft_time_limit=int(settings.CLAMAV_READ_TIMEOUT_SECONDS) + 30,
    time_limit=int(settings.CLAMAV_READ_TIMEOUT_SECONDS) + 60,
)
def scan_upload_session(self, session_id):
    """Scan once; database attempts, rather than Celery delivery count, cap retries."""
    outcome = process_upload_scan(session_id)
    if outcome.retry_after_seconds is not None:
        raise self.retry(countdown=outcome.retry_after_seconds)
    return {'state': outcome.state, 'result_code': outcome.result_code}


def _dispatch(session_id):
    try:
        scan_upload_session.delay(session_id)
        return True
    except Exception:  # noqa: BLE001 - next reconciliation sweep recovers the durable row
        logger.warning('Unable to enqueue upload scan.')
        return False


@shared_task
def dispatch_pending_upload_scans(limit=None):
    """Recover quarantined/error/stale-scanning sessions after broker or worker loss."""
    now = timezone.now()
    limit = max(1, min(int(limit or settings.UPLOAD_CLEANUP_BATCH_SIZE), 1000))
    ready_error = Q(state=UploadState.ERROR) & (
        Q(next_scan_at__isnull=True) | Q(next_scan_at__lte=now)
    )
    stale_scan = Q(state=UploadState.SCANNING) & (
        Q(scan_lease_until__isnull=True) | Q(scan_lease_until__lte=now)
    )
    ids = list(
        UploadSession.objects.filter(
            Q(state=UploadState.QUARANTINED) | ready_error | stale_scan,
            expires_at__gt=now,
            scan_attempts__lt=settings.UPLOAD_SCAN_MAX_ATTEMPTS,
        )
        .order_by('next_scan_at', 'created_at')
        .values_list('pk', flat=True)[:limit]
    )
    return sum(_dispatch(session_id) for session_id in ids)


@shared_task
def expire_and_clean_upload_sessions(limit=None):
    """Expire temporary sessions and remove terminal bytes; evidence rows remain."""
    expired = expire_stale_upload_sessions(limit=limit)
    try:
        cleaned = cleanup_upload_objects(limit=limit)
    except Exception:  # noqa: BLE001 - fail closed and retry on the next periodic sweep
        logger.warning('Upload object cleanup failed closed.')
        cleaned = 0
    purged = purge_expired_upload_evidence(limit=limit)
    return {'expired': expired, 'cleaned': cleaned, 'purged': purged}
