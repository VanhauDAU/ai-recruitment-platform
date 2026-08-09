from django.conf import settings
from django.core.checks import Error, register

from .configuration import upload_scanning_configuration_errors


@register()
def upload_scanning_configuration_check(app_configs, **kwargs):
    del app_configs, kwargs
    errors = upload_scanning_configuration_errors(
        enabled=settings.UPLOAD_QUARANTINE_ENABLED,
        backend=settings.UPLOAD_SCANNER_BACKEND,
        allowed_purposes=settings.UPLOAD_SESSION_ALLOWED_PURPOSES,
        clamav_host=settings.CLAMAV_HOST,
        clamav_port=settings.CLAMAV_PORT,
        max_bytes=settings.UPLOAD_MAX_BYTES,
        owner_max_active_sessions=settings.UPLOAD_OWNER_MAX_ACTIVE_SESSIONS,
        owner_max_active_bytes=settings.UPLOAD_OWNER_MAX_ACTIVE_BYTES,
        docx_max_entries=settings.UPLOAD_DOCX_MAX_ENTRIES,
        docx_max_uncompressed_bytes=settings.UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES,
        docx_max_compression_ratio=settings.UPLOAD_DOCX_MAX_COMPRESSION_RATIO,
        spool_memory_bytes=settings.UPLOAD_SPOOL_MEMORY_BYTES,
        session_ttl_seconds=settings.UPLOAD_SESSION_TTL_SECONDS,
        write_lease_seconds=settings.UPLOAD_WRITE_LEASE_SECONDS,
        scan_lease_seconds=settings.UPLOAD_SCAN_LEASE_SECONDS,
        scan_max_attempts=settings.UPLOAD_SCAN_MAX_ATTEMPTS,
        scan_retry_base_seconds=settings.UPLOAD_SCAN_RETRY_BASE_SECONDS,
        clean_retention_days=settings.UPLOAD_CLEAN_RETENTION_DAYS,
        evidence_retention_days=settings.UPLOAD_EVIDENCE_RETENTION_DAYS,
        cleanup_batch_size=settings.UPLOAD_CLEANUP_BATCH_SIZE,
        clamav_connect_timeout_seconds=settings.CLAMAV_CONNECT_TIMEOUT_SECONDS,
        clamav_read_timeout_seconds=settings.CLAMAV_READ_TIMEOUT_SECONDS,
        clamav_stream_chunk_bytes=settings.CLAMAV_STREAM_CHUNK_BYTES,
        production=settings.IS_PRODUCTION,
    )
    return [Error(message, id=f'uploads.E{index:03d}') for index, message in enumerate(errors, 1)]
