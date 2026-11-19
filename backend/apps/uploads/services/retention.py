"""Expiry, byte cleanup and evidence purge for terminal upload sessions."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.uploads.models import (
    UploadAsset,
    UploadSession,
    UploadState,
    ensure_upload_transition,
)
from common.metrics import record_metric
from common.storage.r2 import private_media_storage, quarantine_storage

logger = logging.getLogger(__name__)


def retention_deadline(now=None):
    return (now or timezone.now()) + timedelta(days=settings.UPLOAD_CLEAN_RETENTION_DAYS)


def evidence_deadline(now=None):
    return (now or timezone.now()) + timedelta(days=settings.UPLOAD_EVIDENCE_RETENTION_DAYS)


def expire_locked(session, *, reason, now):
    ensure_upload_transition(session.state, UploadState.EXPIRED)
    session.state = UploadState.EXPIRED
    session.terminal_reason = reason
    session.upload_lease_token = None
    session.upload_lease_until = None
    session.scan_lease_token = None
    session.scan_lease_until = None
    session.next_scan_at = None
    session.lock_version += 1
    session.save(
        update_fields=[
            'state',
            'terminal_reason',
            'upload_lease_token',
            'upload_lease_until',
            'scan_lease_token',
            'scan_lease_until',
            'next_scan_at',
            'lock_version',
            'updated_at',
        ]
    )
    record_metric('upload_session_state', state=UploadState.EXPIRED, reason=reason)


def expire_stale_upload_sessions(*, limit=None):
    """Mark a bounded batch expired; byte cleanup is a separate idempotent step."""
    now = timezone.now()
    limit = max(1, min(int(limit or settings.UPLOAD_CLEANUP_BATCH_SIZE), 1000))
    ids = list(
        UploadSession.objects.filter(expires_at__lte=now)
        .exclude(state__in=[UploadState.EXPIRED, UploadState.REJECTED])
        .order_by('expires_at')
        .values_list('pk', flat=True)[:limit]
    )
    expired = []
    for session_id in ids:
        with transaction.atomic():
            session = UploadSession.objects.select_for_update().filter(pk=session_id).first()
            if session is None or session.expires_at > now or session.state == UploadState.EXPIRED:
                continue
            asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
            if session.legal_hold_at or (asset and asset.legal_hold_at):
                continue
            if asset and asset.claimed_at and asset.released_at is None:
                continue
            if asset and asset.claimed_at and asset.retained_until > now:
                continue
            expire_locked(session, reason='ttl_expired', now=now)
            expired.append(session_id)
    for session_id in expired:
        cleanup_terminal_upload(session_id)
    return len(expired)


def cleanup_terminal_upload(session_id):
    try:
        return cleanup_upload_objects(session_ids=[session_id])
    except Exception:  # noqa: BLE001 - periodic reconciliation retries without exposing details
        logger.warning('Terminal upload cleanup deferred.')
        return 0


def cleanup_upload_objects(*, session_ids=None, limit=None):
    """Delete terminal bytes idempotently while retaining redacted database evidence."""
    limit = max(1, min(int(limit or settings.UPLOAD_CLEANUP_BATCH_SIZE), 1000))
    if session_ids is None:
        session_ids = list(
            UploadSession.objects.filter(
                Q(quarantine_storage_key__gt='')
                & Q(state__in=[UploadState.CLEAN, UploadState.REJECTED, UploadState.EXPIRED])
                | Q(state=UploadState.EXPIRED, asset__storage_key__gt='')
            )
            .order_by('updated_at')
            .values_list('pk', flat=True)[:limit]
        )
    cleaned = 0
    for session_id in list(session_ids)[:limit]:
        with transaction.atomic():
            session = UploadSession.objects.select_for_update().filter(pk=session_id).first()
            if session is None:
                continue
            asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
            if session.legal_hold_at or (asset and asset.legal_hold_at):
                continue
            now = timezone.now()
            if session.quarantine_storage_key and session.state in {
                UploadState.CLEAN,
                UploadState.REJECTED,
                UploadState.EXPIRED,
            }:
                quarantine_storage().delete(session.quarantine_storage_key)
                session.quarantine_storage_key = ''
                session.quarantine_deleted_at = now
                session.save(
                    update_fields=[
                        'quarantine_storage_key',
                        'quarantine_deleted_at',
                        'updated_at',
                    ]
                )
                cleaned += 1
            if (
                asset
                and session.state == UploadState.EXPIRED
                and asset.storage_key
                and asset.deleted_at is None
                and (
                    asset.claimed_at is None
                    or (asset.released_at is not None and asset.retained_until <= now)
                )
            ):
                private_media_storage().delete(asset.storage_key)
                asset.storage_key = ''
                asset.deleted_at = now
                asset.save(update_fields=['storage_key', 'deleted_at', 'updated_at'])
                cleaned += 1
    return cleaned


def _privacy_scrub_deleted_asset(asset):
    """Remove retained PII only after bytes and every active claim are gone."""
    if (
        asset.storage_key
        or asset.deleted_at is None
        or asset.legal_hold_at
        or (asset.claimed_at and asset.released_at is None)
    ):
        return False
    asset.owner = None
    asset.source_session = None
    asset.purpose = ''
    asset.original_filename = ''
    asset.content_type = ''
    asset.size_bytes = 0
    asset.checksum_sha256 = ''
    asset.claimed_at = None
    asset.claim_scope = ''
    asset.claim_reference = ''
    asset.released_at = None
    asset.release_reason_code = ''
    asset.save(
        update_fields=[
            'owner',
            'source_session',
            'purpose',
            'original_filename',
            'content_type',
            'size_bytes',
            'checksum_sha256',
            'claimed_at',
            'claim_scope',
            'claim_reference',
            'released_at',
            'release_reason_code',
            'updated_at',
        ]
    )
    return True


def purge_expired_upload_evidence(*, limit=None):
    """Purge bounded terminal evidence only after every retained byte is gone."""
    now = timezone.now()
    limit = max(1, min(int(limit or settings.UPLOAD_CLEANUP_BATCH_SIZE), 1000))
    candidates = list(
        UploadSession.objects.filter(
            state__in=[UploadState.REJECTED, UploadState.EXPIRED],
            evidence_retained_until__lte=now,
            quarantine_storage_key='',
        )
        .filter(Q(asset__isnull=True) | Q(asset__deleted_at__isnull=False, asset__storage_key=''))
        .order_by('evidence_retained_until')
        .values_list('pk', flat=True)[:limit]
    )
    purged = 0
    for session_id in candidates:
        with transaction.atomic():
            session = UploadSession.objects.select_for_update().filter(pk=session_id).first()
            if (
                session is None
                or session.evidence_retained_until > now
                or session.quarantine_storage_key
                or session.legal_hold_at
            ):
                continue
            asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
            if asset and (asset.storage_key or asset.deleted_at is None or asset.legal_hold_at):
                continue
            if asset and not _privacy_scrub_deleted_asset(asset):
                continue
            session.delete()
            purged += 1
    return purged
