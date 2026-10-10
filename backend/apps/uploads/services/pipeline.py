"""Transactional, fail-closed shared upload pipeline."""

from __future__ import annotations

import logging
import re
import uuid
import zipfile
from contextlib import closing
from dataclasses import dataclass
from datetime import timedelta
from hashlib import sha256
from pathlib import PurePosixPath
from tempfile import SpooledTemporaryFile
from time import monotonic

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.uploads.configuration import PURPOSE_ROLE_CAPABILITIES
from apps.uploads.models import (
    UploadAsset,
    UploadScanAttempt,
    UploadScanAttemptStatus,
    UploadSession,
    UploadState,
    UploadTrustStatus,
    ensure_upload_transition,
    upload_trust_is_attachable,
)
from common.metrics import record_metric
from common.public_id import generate_public_id
from common.r2_storage import private_media_storage, quarantine_storage

from .errors import UploadServiceError, upload_error
from .scanners import ScannerError, ScannerResult, ScannerVerdict, get_upload_scanner

logger = logging.getLogger(__name__)

PURPOSE_PATTERN = re.compile(r'^[a-z][a-z0-9_.-]{1,63}$')
REFERENCE_PATTERN = re.compile(r'^[A-Za-z0-9_.:-]{1,64}$')
SIGNATURES = (
    (b'%PDF-', 'application/pdf'),
    (b'\x89PNG\r\n\x1a\n', 'image/png'),
    (b'\xff\xd8\xff', 'image/jpeg'),
    (b'GIF87a', 'image/gif'),
    (b'GIF89a', 'image/gif'),
    (b'PK\x03\x04', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
)
WEBP_RIFF = b'RIFF'
WEBP_MARKER = b'WEBP'


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


def _allowed_purposes():
    return frozenset(settings.UPLOAD_SESSION_ALLOWED_PURPOSES)


def _normalise_purpose(value):
    purpose = str(value or '').strip().lower()
    if not PURPOSE_PATTERN.fullmatch(purpose):
        raise upload_error('UPLOAD_INVALID_METADATA')
    if purpose not in _allowed_purposes():
        raise upload_error('UPLOAD_PURPOSE_NOT_ALLOWED')
    return purpose


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


def _safe_filename(value):
    name = str(value or '').replace('\\', '/').rsplit('/', 1)[-1].strip()
    name = ''.join(character for character in name if character.isprintable())
    if not name or len(name) > 255 or name in {'.', '..'}:
        raise upload_error('UPLOAD_INVALID_METADATA')
    return name


def _normalise_content_type(value):
    content_type = str(value or '').partition(';')[0].strip().lower()
    aliases = {'image/jpg': 'image/jpeg'}
    return aliases.get(content_type, content_type)


def _detect_content_type(header):
    if header.startswith(WEBP_RIFF) and header[8:12] == WEBP_MARKER:
        return 'image/webp'
    for signature, content_type in SIGNATURES:
        if header.startswith(signature):
            return content_type
    return ''


def _validate_docx_container(stream):
    """Inspect bounded ZIP metadata only; never extract or parse Office content."""
    try:
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            entries = archive.infolist()
            if not entries or len(entries) > settings.UPLOAD_DOCX_MAX_ENTRIES:
                raise upload_error('UPLOAD_CONTENT_MISMATCH')
            names = set()
            total_uncompressed = 0
            total_compressed = 0
            for entry in entries:
                name = entry.filename
                path = PurePosixPath(name)
                if (
                    not name
                    or '\x00' in name
                    or '\\' in name
                    or name.startswith('/')
                    or '..' in path.parts
                    or entry.flag_bits & 0x1
                    or entry.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}
                ):
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                normalised_name = path.as_posix()
                if normalised_name in names or any(':' in part for part in path.parts):
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                unix_mode = entry.external_attr >> 16
                if unix_mode and (unix_mode & 0o170000) == 0o120000:
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                names.add(normalised_name)
                total_uncompressed += entry.file_size
                total_compressed += entry.compress_size
                if total_uncompressed > settings.UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES:
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                if entry.file_size and (
                    entry.compress_size == 0
                    or entry.file_size / entry.compress_size
                    > settings.UPLOAD_DOCX_MAX_COMPRESSION_RATIO
                ):
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
            if total_uncompressed and (
                total_compressed == 0
                or total_uncompressed / total_compressed
                > settings.UPLOAD_DOCX_MAX_COMPRESSION_RATIO
            ):
                raise upload_error('UPLOAD_CONTENT_MISMATCH')
            if not {'[Content_Types].xml', 'word/document.xml'}.issubset(names):
                raise upload_error('UPLOAD_CONTENT_MISMATCH')
    except (OSError, ValueError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        raise upload_error('UPLOAD_CONTENT_MISMATCH') from exc


def _validate_reference(value):
    reference = str(value or '').strip()
    if not REFERENCE_PATTERN.fullmatch(reference):
        raise upload_error('UPLOAD_INVALID_METADATA')
    return reference


def _normalise_storage_key(value):
    key = str(value or '')
    path = PurePosixPath(key)
    if not key or key.startswith('/') or '\\' in key or '..' in path.parts:
        raise upload_error('UPLOAD_INVALID_METADATA')
    return path.as_posix()


def _retention_deadline(now=None):
    return (now or timezone.now()) + timedelta(days=settings.UPLOAD_CLEAN_RETENTION_DAYS)


def _evidence_deadline(now=None):
    return (now or timezone.now()) + timedelta(days=settings.UPLOAD_EVIDENCE_RETENTION_DAYS)


def ensure_upload_pipeline_enabled():
    if not settings.UPLOAD_QUARANTINE_ENABLED:
        raise upload_error('UPLOAD_PIPELINE_DISABLED', retryable=True)


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
    purpose = _normalise_purpose(purpose)
    original_filename = _safe_filename(original_filename)
    content_type = _normalise_content_type(content_type)
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
            evidence_retained_until=_evidence_deadline(now),
        )
    record_metric('upload_session_state', state=UploadState.UPLOADING)
    return session


def _expire_locked(session, *, reason, now):
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
                _expire_locked(session, reason='ttl_expired', now=now)
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


def _spool_and_validate(upload, *, session):
    upload_name = _safe_filename(getattr(upload, 'name', ''))
    if upload_name != session.original_filename:
        raise upload_error('UPLOAD_INVALID_METADATA')
    upload_type = _normalise_content_type(getattr(upload, 'content_type', ''))
    if upload_type != session.declared_content_type:
        raise upload_error('UPLOAD_CONTENT_MISMATCH')

    temporary = SpooledTemporaryFile(
        max_size=settings.UPLOAD_SPOOL_MEMORY_BYTES,
        mode='w+b',
    )
    digest = sha256()
    size = 0
    header = bytearray()
    try:
        chunks = (
            upload.chunks()
            if hasattr(upload, 'chunks')
            else iter(lambda: upload.read(1024**2), b'')
        )
        for chunk in chunks:
            if not chunk:
                continue
            size += len(chunk)
            if size > settings.UPLOAD_MAX_BYTES:
                raise upload_error('UPLOAD_TOO_LARGE')
            if len(header) < 16:
                header.extend(chunk[: 16 - len(header)])
            digest.update(chunk)
            temporary.write(chunk)
        if size != session.expected_size_bytes:
            raise upload_error('UPLOAD_CONTENT_MISMATCH')
        detected_type = _detect_content_type(bytes(header))
        if detected_type != session.declared_content_type:
            raise upload_error('UPLOAD_CONTENT_MISMATCH')
        if detected_type == (
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ):
            _validate_docx_container(temporary)
        temporary.seek(0)
        return temporary, size, digest.hexdigest(), detected_type
    except Exception:
        temporary.close()
        raise


def store_quarantined_upload(*, owner, public_id, upload):
    """Persist one validated payload to quarantine and atomically publish its key."""
    ensure_upload_pipeline_enabled()
    session_id, token, version = _claim_upload(owner, public_id)
    session = UploadSession.objects.get(pk=session_id)
    try:
        temporary, size, checksum, detected_type = _spool_and_validate(upload, session=session)
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
            _expire_locked(session, reason='ttl_expired', now=now)
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
    _cleanup_terminal_upload(claim.session_id)
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
                trust_status=UploadTrustStatus.CLEAN,
                purpose=session.purpose,
                original_filename=session.original_filename,
                content_type=session.detected_content_type,
                size_bytes=session.size_bytes,
                checksum_sha256=session.checksum_sha256,
                storage_key=storage_key,
                retained_until=_retention_deadline(now),
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
    _cleanup_terminal_upload(claim.session_id)
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
        _expire_locked(session, reason='cancelled', now=now)
        session.cancelled_at = now
        session.save(update_fields=['cancelled_at', 'updated_at'])
    _cleanup_terminal_upload(session.pk)
    return session


def claim_clean_upload(
    *,
    owner,
    public_id,
    expected_purpose,
    claim_scope,
    claim_reference,
):
    """Explicitly attach a clean upload; repeated identical claims are idempotent."""
    expected_purpose = _normalise_purpose(expected_purpose)
    claim_scope = _validate_reference(claim_scope)
    claim_reference = _validate_reference(claim_reference)
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.purpose != expected_purpose:
            raise upload_error('UPLOAD_PURPOSE_MISMATCH')
        if session.state != UploadState.CLEAN or session.expires_at <= now:
            raise upload_error('UPLOAD_NOT_CLEAN')
        asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
        if (
            asset is None
            or asset.deleted_at is not None
            or not asset.storage_key
            or not upload_trust_is_attachable(asset.trust_status)
        ):
            raise upload_error('UPLOAD_NOT_CLEAN')
        if asset.claimed_at:
            if asset.claim_scope == claim_scope and asset.claim_reference == claim_reference:
                return asset
            raise upload_error('UPLOAD_ALREADY_SUBMITTED')
        retained_until = max(asset.retained_until, _retention_deadline(now))
        asset.claimed_at = now
        asset.claim_scope = claim_scope
        asset.claim_reference = claim_reference
        asset.retained_until = retained_until
        asset.save(
            update_fields=[
                'claimed_at',
                'claim_scope',
                'claim_reference',
                'retained_until',
                'updated_at',
            ]
        )
        session.expires_at = retained_until
        session.save(update_fields=['expires_at', 'updated_at'])
        return asset


def release_claimed_upload(
    *,
    owner,
    public_id,
    expected_purpose,
    claim_scope,
    claim_reference,
    reason_code,
):
    """Release a domain reference without shortening the approved retention window."""
    expected_purpose = _normalise_purpose(expected_purpose)
    claim_scope = _validate_reference(claim_scope)
    claim_reference = _validate_reference(claim_reference)
    reason_code = _validate_reference(reason_code)
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.purpose != expected_purpose:
            raise upload_error('UPLOAD_PURPOSE_MISMATCH')
        asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
        if (
            asset is None
            or asset.claimed_at is None
            or asset.claim_scope != claim_scope
            or asset.claim_reference != claim_reference
        ):
            raise upload_error('RESOURCE_NOT_FOUND')
        if asset.released_at:
            if asset.release_reason_code == reason_code:
                return asset
            raise upload_error('UPLOAD_INVALID_STATE')
        asset.released_at = now
        asset.release_reason_code = reason_code
        asset.save(update_fields=['released_at', 'release_reason_code', 'updated_at'])
        return asset


def register_legacy_trusted_asset(
    *,
    owner,
    purpose,
    original_filename,
    content_type,
    size_bytes,
    storage_key,
    claim_scope,
    claim_reference,
    retained_until=None,
):
    """Classify an existing object without scanning or inventing clean evidence."""
    purpose = _normalise_purpose(purpose)
    original_filename = _safe_filename(original_filename)
    content_type = _normalise_content_type(content_type)
    storage_key = _normalise_storage_key(storage_key)
    claim_scope = _validate_reference(claim_scope)
    claim_reference = _validate_reference(claim_reference)
    try:
        size_bytes = int(size_bytes)
    except (TypeError, ValueError) as exc:
        raise upload_error('UPLOAD_INVALID_METADATA') from exc
    if size_bytes <= 0:
        raise upload_error('UPLOAD_INVALID_METADATA')
    now = timezone.now()
    minimum_retained_until = _retention_deadline(now)
    if retained_until is None or retained_until < minimum_retained_until:
        retained_until = minimum_retained_until
    return UploadAsset.objects.create(
        owner=owner,
        trust_status=UploadTrustStatus.LEGACY_TRUSTED,
        purpose=purpose,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        checksum_sha256='',
        storage_key=storage_key,
        claimed_at=now,
        claim_scope=claim_scope,
        claim_reference=claim_reference,
        retained_until=retained_until,
    )


def place_upload_legal_hold(*, asset_public_id, reason_code):
    """Internal retention primitive; domain code remains responsible for admin audit."""
    reason_code = _validate_reference(reason_code)
    now = timezone.now()
    source_session_id = (
        UploadAsset.objects.filter(public_id=asset_public_id)
        .values_list('source_session_id', flat=True)
        .first()
    )
    with transaction.atomic():
        session = None
        if source_session_id:
            session = UploadSession.objects.select_for_update().filter(pk=source_session_id).first()
        asset = UploadAsset.objects.select_for_update().filter(public_id=asset_public_id).first()
        if asset is None or asset.deleted_at is not None:
            raise upload_error('RESOURCE_NOT_FOUND')
        asset.legal_hold_at = asset.legal_hold_at or now
        asset.legal_hold_reason_code = reason_code
        asset.save(update_fields=['legal_hold_at', 'legal_hold_reason_code', 'updated_at'])
        if session is not None and asset.source_session_id == session.pk:
            UploadSession.objects.filter(pk=session.pk).update(
                legal_hold_at=asset.legal_hold_at,
                legal_hold_reason_code=reason_code,
                updated_at=now,
            )
        return asset


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
            _expire_locked(session, reason='ttl_expired', now=now)
            expired.append(session_id)
    for session_id in expired:
        _cleanup_terminal_upload(session_id)
    return len(expired)


def _cleanup_terminal_upload(session_id):
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
