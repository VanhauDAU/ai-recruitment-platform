"""Owner-facing upload session lifecycle: create, write to quarantine, cancel, retry."""

from __future__ import annotations

import logging
import uuid
from contextlib import closing
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.uploads.domain.configuration import PURPOSE_ROLE_CAPABILITIES
from apps.uploads.models import (
    UploadAsset,
    UploadSession,
    UploadState,
    ensure_upload_transition,
)
from common.metrics import record_metric
from common.storage.r2 import quarantine_storage

from .errors import upload_error
from .retention import cleanup_terminal_upload, evidence_deadline, expire_locked
from .validation import normalise_content_type, normalise_purpose, safe_filename, spool_and_validate

logger = logging.getLogger(__name__)


def ensure_upload_pipeline_enabled():
    if not settings.UPLOAD_QUARANTINE_ENABLED:
        raise upload_error('UPLOAD_PIPELINE_DISABLED', retryable=True)


def _ensure_owner_purpose_capability(owner, purpose):
    allowed_roles = PURPOSE_ROLE_CAPABILITIES.get(purpose, frozenset())
    if getattr(owner, 'role', None) not in allowed_roles:
        raise upload_error('UPLOAD_PURPOSE_FORBIDDEN')


def _active_owner_sessions(owner_id, *, now):
    unfinished = Q(
        state__in=(
            UploadState.UPLOADING,
            UploadState.QUARANTINED,
            UploadState.SCANNING,
            UploadState.ERROR,
        )
    )
    unclaimed_clean = Q(state=UploadState.CLEAN, asset__claimed_at__isnull=True)
    live_temporary_session = Q(expires_at__gt=now) & (unfinished | unclaimed_clean)
    retained_quarantine_bytes = ~Q(quarantine_storage_key='')
    retained_unclaimed_private_bytes = Q(
        asset__claimed_at__isnull=True,
        asset__deleted_at__isnull=True,
        asset__storage_key__gt='',
    )
    return UploadSession.objects.filter(owner_id=owner_id).filter(
        live_temporary_session | retained_quarantine_bytes | retained_unclaimed_private_bytes
    )


def create_upload_session(
    *,
    owner,
    purpose,
    original_filename,
    content_type,
    expected_size_bytes,
):
    """Create metadata only; no business request or storage object is created."""
    ensure_upload_pipeline_enabled()
    if owner is None or not getattr(owner, 'is_authenticated', False):
        raise upload_error('RESOURCE_NOT_FOUND')
    purpose = normalise_purpose(purpose)
    original_filename = safe_filename(original_filename)
    content_type = normalise_content_type(content_type)
    if content_type not in settings.UPLOAD_ALLOWED_CONTENT_TYPES:
        raise upload_error('UPLOAD_TYPE_NOT_ALLOWED')
    try:
        expected_size_bytes = int(expected_size_bytes)
    except (TypeError, ValueError) as exc:
        raise upload_error('UPLOAD_INVALID_METADATA') from exc
    if expected_size_bytes <= 0:
        raise upload_error('UPLOAD_INVALID_METADATA')
    if expected_size_bytes > settings.UPLOAD_MAX_BYTES:
        raise upload_error('UPLOAD_TOO_LARGE')

    now = timezone.now()
    with transaction.atomic():
        locked_owner = (
            get_user_model()._default_manager.select_for_update().filter(pk=owner.pk).first()
        )
        if locked_owner is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        _ensure_owner_purpose_capability(locked_owner, purpose)
        usage = _active_owner_sessions(locked_owner.pk, now=now).aggregate(
            active_sessions=Count('pk'),
            active_bytes=Sum('expected_size_bytes'),
        )
        if usage['active_sessions'] >= settings.UPLOAD_OWNER_MAX_ACTIVE_SESSIONS:
            raise upload_error('UPLOAD_SESSION_QUOTA_EXCEEDED', retryable=True)
        if (
            usage['active_bytes'] or 0
        ) + expected_size_bytes > settings.UPLOAD_OWNER_MAX_ACTIVE_BYTES:
            raise upload_error('UPLOAD_BYTE_QUOTA_EXCEEDED', retryable=True)
        session = UploadSession.objects.create(
            owner=locked_owner,
            purpose=purpose,
            original_filename=original_filename,
            declared_content_type=content_type,
            expected_size_bytes=expected_size_bytes,
            expires_at=now + timedelta(seconds=settings.UPLOAD_SESSION_TTL_SECONDS),
            evidence_retained_until=evidence_deadline(now),
        )
    record_metric('upload_session_state', state=UploadState.UPLOADING)
    return session


def _claim_upload(owner, public_id):
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.expires_at <= now:
            if session.state != UploadState.EXPIRED:
                expire_locked(session, reason='ttl_expired', now=now)
            raise upload_error('UPLOAD_EXPIRED')
        if session.state != UploadState.UPLOADING:
            raise upload_error('UPLOAD_INVALID_STATE')
        if session.upload_lease_until and session.upload_lease_until > now:
            raise upload_error('UPLOAD_BUSY', retryable=True)
        token = uuid.uuid4()
        session.upload_lease_token = token
        session.upload_lease_until = now + timedelta(seconds=settings.UPLOAD_WRITE_LEASE_SECONDS)
        session.lock_version += 1
        session.save(
            update_fields=[
                'upload_lease_token',
                'upload_lease_until',
                'lock_version',
                'updated_at',
            ]
        )
        return session.pk, token, session.lock_version


def _release_upload_lease(session_id, token):
    UploadSession.objects.filter(
        pk=session_id,
        state=UploadState.UPLOADING,
        upload_lease_token=token,
    ).update(upload_lease_token=None, upload_lease_until=None, updated_at=timezone.now())


def store_quarantined_upload(*, owner, public_id, upload):
    """Persist one validated payload to quarantine and atomically publish its key."""
    ensure_upload_pipeline_enabled()
    session_id, token, version = _claim_upload(owner, public_id)
    session = UploadSession.objects.get(pk=session_id)
    try:
        temporary, size, checksum, detected_type = spool_and_validate(upload, session=session)
        key = f'sessions/{session.public_id}/write-{version}.upload'
        try:
            with closing(temporary):
                saved_key = quarantine_storage().save(key, File(temporary, name='payload.upload'))
        except Exception as exc:  # noqa: BLE001 - storage messages may expose provider details
            raise upload_error('UPLOAD_STORAGE_FAILED', retryable=True) from exc
    except Exception:
        _release_upload_lease(session_id, token)
        raise

    now = timezone.now()
    try:
        with transaction.atomic():
            locked = UploadSession.objects.select_for_update().get(pk=session_id)
            if (
                locked.state != UploadState.UPLOADING
                or locked.upload_lease_token != token
                or locked.expires_at <= now
            ):
                raise upload_error('UPLOAD_EXPIRED')
            ensure_upload_transition(locked.state, UploadState.QUARANTINED)
            locked.state = UploadState.QUARANTINED
            locked.quarantine_storage_key = saved_key
            locked.size_bytes = size
            locked.checksum_sha256 = checksum
            locked.detected_content_type = detected_type
            locked.upload_lease_token = None
            locked.upload_lease_until = None
            locked.next_scan_at = now
            locked.lock_version += 1
            locked.save(
                update_fields=[
                    'state',
                    'quarantine_storage_key',
                    'size_bytes',
                    'checksum_sha256',
                    'detected_content_type',
                    'upload_lease_token',
                    'upload_lease_until',
                    'next_scan_at',
                    'lock_version',
                    'updated_at',
                ]
            )
    except Exception:
        try:
            quarantine_storage().delete(saved_key)
        except Exception:  # noqa: BLE001 - retained orphan is handled by storage reconciliation
            logger.warning('Unable to remove an unclaimed quarantine object.')
        raise
    record_metric('upload_session_state', state=UploadState.QUARANTINED)
    return locked


def cancel_upload_session(*, owner, public_id):
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.state == UploadState.EXPIRED:
            return session
        asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
        if asset and asset.claimed_at:
            raise upload_error('UPLOAD_ALREADY_SUBMITTED')
        expire_locked(session, reason='cancelled', now=now)
        session.cancelled_at = now
        session.save(update_fields=['cancelled_at', 'updated_at'])
    cleanup_terminal_upload(session.pk)
    return session


def request_scan_retry(*, owner, public_id):
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.state != UploadState.ERROR:
            raise upload_error('UPLOAD_INVALID_STATE')
        if session.scan_attempts >= settings.UPLOAD_SCAN_MAX_ATTEMPTS:
            raise upload_error('UPLOAD_SCAN_FAILED')
        session.next_scan_at = now
        session.save(update_fields=['next_scan_at', 'updated_at'])
        return session


def enqueue_upload_scan(session_id):
    """Ask a worker to scan now; periodic reconciliation retries if the broker is down."""
    # Import lazily: the scan task imports this service module.
    from ..tasks import scan_upload_session

    try:
        scan_upload_session.delay(session_id)
    except Exception:  # noqa: BLE001 - periodic reconciliation owns broker recovery
        logger.warning('Unable to enqueue owner upload scan.')
