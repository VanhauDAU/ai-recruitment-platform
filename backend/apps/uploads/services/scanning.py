"""Lease-guarded malware scan of one quarantined session and its verdict."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta
from hashlib import sha256
from tempfile import SpooledTemporaryFile
from time import monotonic

from django.conf import settings
from django.core.files import File
from django.db import transaction
from django.utils import timezone

from apps.uploads.models import (
    UploadAsset,
    UploadScanAttempt,
    UploadScanAttemptStatus,
    UploadSession,
    UploadState,
    ensure_upload_transition,
)
from common.db.public_id import generate_public_id
from common.metrics import record_metric
from common.storage.r2 import private_media_storage, quarantine_storage

from .errors import UploadServiceError, upload_error
from .retention import cleanup_terminal_upload, expire_locked, retention_deadline
from .scanners import ScannerError, ScannerResult, ScannerVerdict, get_upload_scanner
from .sessions import ensure_upload_pipeline_enabled

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScanOutcome:
    state: str
    result_code: str = ''
    retry_after_seconds: int | None = None


@dataclass(frozen=True)
class _ScanClaim:
    session_id: int
    public_id: str
    quarantine_key: str
    checksum_sha256: str
    size_bytes: int
    lease_token: uuid.UUID
    attempt_number: int
    started_monotonic: float


def _complete_stale_attempt(session, now):
    UploadScanAttempt.objects.filter(
        session=session,
        status=UploadScanAttemptStatus.RUNNING,
    ).update(
        status=UploadScanAttemptStatus.ERROR,
        result_code='scan_lease_expired',
        completed_at=now,
        duration_ms=0,
    )


def _claim_scan(session_id):
    now = timezone.now()
    with transaction.atomic():
        session = UploadSession.objects.select_for_update().filter(pk=session_id).first()
        if session is None:
            return ScanOutcome(state='missing', result_code='resource_missing')
        if session.state in {UploadState.CLEAN, UploadState.REJECTED, UploadState.EXPIRED}:
            return ScanOutcome(state=session.state, result_code=session.scan_result_code)
        if session.expires_at <= now:
            expire_locked(session, reason='ttl_expired', now=now)
            return ScanOutcome(state=UploadState.EXPIRED, result_code='ttl_expired')
        if session.state == UploadState.SCANNING:
            if session.scan_lease_until and session.scan_lease_until > now:
                return ScanOutcome(state='busy', result_code='scan_in_progress')
            _complete_stale_attempt(session, now)
            ensure_upload_transition(session.state, UploadState.ERROR)
            session.state = UploadState.ERROR
            session.scan_result_code = 'scan_lease_expired'
        if session.state == UploadState.ERROR:
            if session.scan_attempts >= settings.UPLOAD_SCAN_MAX_ATTEMPTS:
                return ScanOutcome(state=UploadState.ERROR, result_code=session.scan_result_code)
            if session.next_scan_at and session.next_scan_at > now:
                delay = max(1, round((session.next_scan_at - now).total_seconds()))
                return ScanOutcome(
                    state='deferred',
                    result_code=session.scan_result_code,
                    retry_after_seconds=delay,
                )
        if session.state not in {UploadState.QUARANTINED, UploadState.ERROR}:
            return ScanOutcome(state=session.state, result_code='invalid_state')

        ensure_upload_transition(session.state, UploadState.SCANNING)
        lease_token = uuid.uuid4()
        session.state = UploadState.SCANNING
        session.scan_attempts += 1
        session.scan_lease_token = lease_token
        session.scan_lease_until = now + timedelta(seconds=settings.UPLOAD_SCAN_LEASE_SECONDS)
        session.scan_started_at = now
        session.scan_completed_at = None
        session.next_scan_at = None
        session.scan_result_code = ''
        session.lock_version += 1
        session.save(
            update_fields=[
                'state',
                'scan_attempts',
                'scan_lease_token',
                'scan_lease_until',
                'scan_started_at',
                'scan_completed_at',
                'next_scan_at',
                'scan_result_code',
                'lock_version',
                'updated_at',
            ]
        )
        UploadScanAttempt.objects.create(
            session=session,
            attempt_number=session.scan_attempts,
            lease_token=lease_token,
            started_at=now,
        )
        return _ScanClaim(
            session_id=session.pk,
            public_id=session.public_id,
            quarantine_key=session.quarantine_storage_key,
            checksum_sha256=session.checksum_sha256,
            size_bytes=session.size_bytes,
            lease_token=lease_token,
            attempt_number=session.scan_attempts,
            started_monotonic=monotonic(),
        )


def _duration_ms(claim):
    return max(0, round((monotonic() - claim.started_monotonic) * 1000))


def _hash_optional(value):
    return sha256(value.encode('utf-8')).hexdigest() if value else ''


def _finish_attempt(claim, *, status, result_code, result=None):
    UploadScanAttempt.objects.filter(
        session_id=claim.session_id,
        attempt_number=claim.attempt_number,
        lease_token=claim.lease_token,
        status=UploadScanAttemptStatus.RUNNING,
    ).update(
        status=status,
        result_code=result_code,
        threat_signature_sha256=_hash_optional(result.signature) if result else '',
        scanner_revision_sha256=_hash_optional(result.revision) if result else '',
        completed_at=timezone.now(),
        duration_ms=_duration_ms(claim),
    )


def _finish_scan_error(claim, code):
    now = timezone.now()
    retry_delay = None
    with transaction.atomic():
        session = UploadSession.objects.select_for_update().filter(pk=claim.session_id).first()
        if session is None:
            return ScanOutcome(state='missing', result_code='resource_missing')
        if session.state != UploadState.SCANNING or session.scan_lease_token != claim.lease_token:
            _finish_attempt(
                claim,
                status=UploadScanAttemptStatus.ERROR,
                result_code='scan_superseded',
            )
            return ScanOutcome(state=session.state, result_code='scan_superseded')
        ensure_upload_transition(session.state, UploadState.ERROR)
        session.state = UploadState.ERROR
        session.scan_result_code = code
        session.scan_completed_at = now
        session.scan_lease_token = None
        session.scan_lease_until = None
        if session.scan_attempts < settings.UPLOAD_SCAN_MAX_ATTEMPTS:
            retry_delay = settings.UPLOAD_SCAN_RETRY_BASE_SECONDS * (
                2 ** (session.scan_attempts - 1)
            )
            session.next_scan_at = now + timedelta(seconds=retry_delay)
            session.terminal_reason = ''
        else:
            session.next_scan_at = None
            session.terminal_reason = 'scan_attempts_exhausted'
        session.lock_version += 1
        session.save(
            update_fields=[
                'state',
                'scan_result_code',
                'scan_completed_at',
                'scan_lease_token',
                'scan_lease_until',
                'next_scan_at',
                'terminal_reason',
                'lock_version',
                'updated_at',
            ]
        )
        _finish_attempt(claim, status=UploadScanAttemptStatus.ERROR, result_code=code)
    logger.warning(
        'Upload scan failed closed.',
        extra={'upload_session_public_id': claim.public_id, 'failure_code': code},
    )
    record_metric('upload_scan_result', status='error', failure_code=code)
    record_metric('upload_scan_duration_ms', _duration_ms(claim), status='error')
    return ScanOutcome(
        state=UploadState.ERROR,
        result_code=code,
        retry_after_seconds=retry_delay,
    )


def _copy_clean_object(claim):
    private = private_media_storage()
    # A lease-unique key prevents a stale worker from deleting the object committed
    # by a newer clean attempt when its own result is later rejected as superseded.
    target_key = (
        f'uploads/clean/{claim.public_id}/attempt-{claim.attempt_number}-{claim.lease_token.hex}'
    )

    digest = sha256()
    size = 0
    temporary = SpooledTemporaryFile(max_size=settings.UPLOAD_SPOOL_MEMORY_BYTES, mode='w+b')
    try:
        with quarantine_storage().open(claim.quarantine_key, 'rb') as source:
            for chunk in iter(lambda: source.read(1024**2), b''):
                size += len(chunk)
                if size > settings.UPLOAD_MAX_BYTES:
                    raise upload_error('UPLOAD_STORAGE_FAILED', retryable=True)
                digest.update(chunk)
                temporary.write(chunk)
        if size != claim.size_bytes or digest.hexdigest() != claim.checksum_sha256:
            raise upload_error('UPLOAD_STORAGE_FAILED', retryable=True)
        temporary.seek(0)
        try:
            return private.save(target_key, File(temporary, name='payload'))
        except Exception:  # noqa: BLE001 - provider errors are normalized by caller
            try:
                private.delete(target_key)
            except Exception:  # noqa: BLE001 - no provider detail may escape logs
                logger.warning('Unable to remove a failed clean upload copy.')
            raise
    finally:
        temporary.close()


def _finish_malicious(claim, result):
    now = timezone.now()
    signature_hash = _hash_optional(result.signature)
    with transaction.atomic():
        session = UploadSession.objects.select_for_update().filter(pk=claim.session_id).first()
        if session is None:
            return ScanOutcome(state='missing', result_code='resource_missing')
        if session.state != UploadState.SCANNING or session.scan_lease_token != claim.lease_token:
            _finish_attempt(
                claim,
                status=UploadScanAttemptStatus.ERROR,
                result_code='scan_superseded',
            )
            return ScanOutcome(state=session.state, result_code='scan_superseded')
        ensure_upload_transition(session.state, UploadState.REJECTED)
        session.state = UploadState.REJECTED
        session.scan_result_code = 'malware_detected'
        session.threat_signature_sha256 = signature_hash
        session.scan_completed_at = now
        session.scan_lease_token = None
        session.scan_lease_until = None
        session.next_scan_at = None
        session.terminal_reason = 'malware_detected'
        session.lock_version += 1
        session.save(
            update_fields=[
                'state',
                'scan_result_code',
                'threat_signature_sha256',
                'scan_completed_at',
                'scan_lease_token',
                'scan_lease_until',
                'next_scan_at',
                'terminal_reason',
                'lock_version',
                'updated_at',
            ]
        )
        _finish_attempt(
            claim,
            status=UploadScanAttemptStatus.MALICIOUS,
            result_code='malware_detected',
            result=result,
        )
    cleanup_terminal_upload(claim.session_id)
    record_metric('upload_scan_result', status='rejected')
    record_metric('upload_scan_duration_ms', _duration_ms(claim), status='rejected')
    record_metric('upload_session_state', state=UploadState.REJECTED)
    return ScanOutcome(state=UploadState.REJECTED, result_code='malware_detected')


def _finish_clean(claim, result, storage_key):
    now = timezone.now()
    committed = False
    try:
        with transaction.atomic():
            session = UploadSession.objects.select_for_update().filter(pk=claim.session_id).first()
            if session is None:
                return ScanOutcome(state='missing', result_code='resource_missing')
            if (
                session.state != UploadState.SCANNING
                or session.scan_lease_token != claim.lease_token
            ):
                _finish_attempt(
                    claim,
                    status=UploadScanAttemptStatus.ERROR,
                    result_code='scan_superseded',
                )
                return ScanOutcome(state=session.state, result_code='scan_superseded')
            ensure_upload_transition(session.state, UploadState.CLEAN)
            UploadAsset.objects.create(
                public_id=generate_public_id('upa'),
                owner=session.owner,
                source_session=session,
                purpose=session.purpose,
                original_filename=session.original_filename,
                content_type=session.detected_content_type,
                size_bytes=session.size_bytes,
                checksum_sha256=session.checksum_sha256,
                storage_key=storage_key,
                retained_until=retention_deadline(now),
            )
            session.state = UploadState.CLEAN
            session.scan_result_code = 'clean'
            session.scan_completed_at = now
            session.scan_lease_token = None
            session.scan_lease_until = None
            session.next_scan_at = None
            session.terminal_reason = ''
            session.lock_version += 1
            session.save(
                update_fields=[
                    'state',
                    'scan_result_code',
                    'scan_completed_at',
                    'scan_lease_token',
                    'scan_lease_until',
                    'next_scan_at',
                    'terminal_reason',
                    'lock_version',
                    'updated_at',
                ]
            )
            _finish_attempt(
                claim,
                status=UploadScanAttemptStatus.CLEAN,
                result_code='clean',
                result=result,
            )
        committed = True
    finally:
        if not committed:
            try:
                private_media_storage().delete(storage_key)
            except Exception:  # noqa: BLE001 - storage reconciliation handles the orphan
                logger.warning('Unable to remove an unclaimed clean upload object.')
    cleanup_terminal_upload(claim.session_id)
    record_metric('upload_scan_result', status='clean')
    record_metric('upload_scan_duration_ms', _duration_ms(claim), status='clean')
    record_metric('upload_session_state', state=UploadState.CLEAN)
    return ScanOutcome(state=UploadState.CLEAN, result_code='clean')


def process_upload_scan(session_id, *, scanner=None):
    """Claim and scan exactly one session; duplicate workers return without side effects."""
    ensure_upload_pipeline_enabled()
    claim = _claim_scan(session_id)
    if isinstance(claim, ScanOutcome):
        return claim
    scanner = scanner or get_upload_scanner()
    try:
        with quarantine_storage().open(claim.quarantine_key, 'rb') as source:
            result = scanner.scan(source)
        if not isinstance(result, ScannerResult):
            return _finish_scan_error(claim, 'scanner_protocol_error')
        if result.verdict == ScannerVerdict.MALICIOUS:
            return _finish_malicious(claim, result)
        if result.verdict != ScannerVerdict.CLEAN:
            return _finish_scan_error(claim, 'scanner_protocol_error')
        storage_key = _copy_clean_object(claim)
        return _finish_clean(claim, result, storage_key)
    except ScannerError as exc:
        return _finish_scan_error(claim, exc.code)
    except UploadServiceError:
        return _finish_scan_error(claim, 'storage_verification_failed')
    except Exception:  # noqa: BLE001 - storage/provider detail must not escape or be logged
        return _finish_scan_error(claim, 'scan_processing_failed')
