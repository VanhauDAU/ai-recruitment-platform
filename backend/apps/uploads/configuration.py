"""Pure deployment validation for the upload scanner feature."""

CLAMAV_BACKEND = 'apps.uploads.services.scanners.ClamAVStreamScanner'
TEST_BACKEND_PREFIXES = (
    'apps.uploads.tests.',
    'unittest.mock.',
)
PURPOSE_ROLE_CAPABILITIES = {
    'candidate_cv': frozenset({'candidate'}),
    'employer_company_update': frozenset({'employer'}),
    'employer_verification': frozenset({'employer'}),
}


def upload_scanning_configuration_errors(
    *,
    enabled,
    backend,
    allowed_purposes,
    clamav_host,
    clamav_port,
    max_bytes,
    owner_max_active_sessions,
    owner_max_active_bytes,
    docx_max_entries,
    docx_max_uncompressed_bytes,
    docx_max_compression_ratio,
    spool_memory_bytes,
    session_ttl_seconds,
    write_lease_seconds,
    scan_lease_seconds,
    scan_max_attempts,
    scan_retry_base_seconds,
    clean_retention_days,
    evidence_retention_days,
    cleanup_batch_size,
    clamav_connect_timeout_seconds,
    clamav_read_timeout_seconds,
    clamav_stream_chunk_bytes,
    production=False,
):
    """Return every unsafe scanner configuration without exposing credentials."""
    if not enabled:
        return []

    errors = []
    if not backend:
        errors.append('UPLOAD_SCANNER_BACKEND là bắt buộc khi upload quarantine được bật.')
    if production and backend.startswith(TEST_BACKEND_PREFIXES):
        errors.append('Production không được dùng fake/test upload scanner backend.')
    if production and backend != CLAMAV_BACKEND:
        errors.append('Production phải dùng ClamAV upload scanner backend đã được duyệt.')
    if not allowed_purposes:
        errors.append('UPLOAD_SESSION_ALLOWED_PURPOSES phải có allowlist khi pipeline được bật.')
    elif any(purpose not in PURPOSE_ROLE_CAPABILITIES for purpose in allowed_purposes):
        errors.append(
            'Mọi upload purpose được bật phải có role capability khai báo tường minh trong code.'
        )
    if backend == CLAMAV_BACKEND and not clamav_host:
        errors.append('CLAMAV_HOST là bắt buộc khi dùng ClamAV scanner backend.')
    if not 1 <= int(clamav_port) <= 65535:
        errors.append('CLAMAV_PORT phải nằm trong khoảng 1..65535.')
    if int(max_bytes) <= 0:
        errors.append('UPLOAD_MAX_BYTES phải lớn hơn 0.')
    if int(owner_max_active_sessions) <= 0:
        errors.append('UPLOAD_OWNER_MAX_ACTIVE_SESSIONS phải lớn hơn 0.')
    if int(owner_max_active_bytes) < int(max_bytes):
        errors.append('UPLOAD_OWNER_MAX_ACTIVE_BYTES không được nhỏ hơn UPLOAD_MAX_BYTES.')
    if not 0 < int(spool_memory_bytes) <= int(max_bytes):
        errors.append('UPLOAD_SPOOL_MEMORY_BYTES phải nằm trong khoảng 1..UPLOAD_MAX_BYTES.')
    if int(docx_max_entries) <= 0:
        errors.append('UPLOAD_DOCX_MAX_ENTRIES phải lớn hơn 0.')
    if int(docx_max_uncompressed_bytes) <= 0:
        errors.append('UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES phải lớn hơn 0.')
    if float(docx_max_compression_ratio) <= 1:
        errors.append('UPLOAD_DOCX_MAX_COMPRESSION_RATIO phải lớn hơn 1.')
    if int(session_ttl_seconds) <= 0:
        errors.append('UPLOAD_SESSION_TTL_SECONDS phải lớn hơn 0.')
    if int(write_lease_seconds) <= 0:
        errors.append('UPLOAD_WRITE_LEASE_SECONDS phải lớn hơn 0.')
    if int(scan_lease_seconds) <= 0:
        errors.append('UPLOAD_SCAN_LEASE_SECONDS phải lớn hơn 0.')
    if int(scan_max_attempts) <= 0:
        errors.append('UPLOAD_SCAN_MAX_ATTEMPTS phải lớn hơn 0.')
    if int(scan_retry_base_seconds) <= 0:
        errors.append('UPLOAD_SCAN_RETRY_BASE_SECONDS phải lớn hơn 0.')
    if int(clean_retention_days) < 730:
        errors.append('UPLOAD_CLEAN_RETENTION_DAYS không được ngắn hơn 730 ngày.')
    if int(evidence_retention_days) <= 0:
        errors.append('UPLOAD_EVIDENCE_RETENTION_DAYS phải lớn hơn 0.')
    if not 1 <= int(cleanup_batch_size) <= 1000:
        errors.append('UPLOAD_CLEANUP_BATCH_SIZE phải nằm trong khoảng 1..1000.')
    if float(clamav_connect_timeout_seconds) <= 0:
        errors.append('CLAMAV_CONNECT_TIMEOUT_SECONDS phải lớn hơn 0.')
    if float(clamav_read_timeout_seconds) <= 0:
        errors.append('CLAMAV_READ_TIMEOUT_SECONDS phải lớn hơn 0.')
    if not 0 < int(clamav_stream_chunk_bytes) <= int(max_bytes):
        errors.append('CLAMAV_STREAM_CHUNK_BYTES phải nằm trong khoảng 1..UPLOAD_MAX_BYTES.')
    return errors
