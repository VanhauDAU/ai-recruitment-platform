"""Public service boundary for shared upload infrastructure."""

from .claims import claim_clean_upload, place_upload_legal_hold, release_claimed_upload
from .errors import UploadServiceError, upload_error
from .retention import (
    cleanup_upload_objects,
    expire_stale_upload_sessions,
    purge_expired_upload_evidence,
)
from .scanners import (
    ClamAVStreamScanner,
    ScannerError,
    ScannerProtocolError,
    ScannerReadiness,
    ScannerResult,
    ScannerTimeout,
    ScannerUnavailable,
    ScannerVerdict,
    get_upload_scanner,
    upload_scanner_readiness,
)
from .scanning import ScanOutcome, process_upload_scan
from .sessions import (
    cancel_upload_session,
    create_upload_session,
    enqueue_upload_scan,
    request_scan_retry,
    store_quarantined_upload,
)

__all__ = [
    'ClamAVStreamScanner',
    'ScanOutcome',
    'ScannerError',
    'ScannerProtocolError',
    'ScannerReadiness',
    'ScannerResult',
    'ScannerTimeout',
    'ScannerUnavailable',
    'ScannerVerdict',
    'UploadServiceError',
    'cancel_upload_session',
    'claim_clean_upload',
    'cleanup_upload_objects',
    'create_upload_session',
    'enqueue_upload_scan',
    'expire_stale_upload_sessions',
    'get_upload_scanner',
    'place_upload_legal_hold',
    'process_upload_scan',
    'purge_expired_upload_evidence',
    'release_claimed_upload',
    'request_scan_retry',
    'store_quarantined_upload',
    'upload_error',
    'upload_scanner_readiness',
]
