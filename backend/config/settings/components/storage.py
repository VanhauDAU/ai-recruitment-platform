"""Media, lưu trữ (local/R2), phiên upload cách ly và quét ClamAV."""

import mimetypes
from pathlib import Path

from decouple import Csv

from config.env import config

from .core import BASE_DIR

# Python 3.11 trong image không có /etc/mime.types nên không biết .webp; django-storages đoán
# Content-Type theo đuôi tệp, nên ảnh WebP (ảnh mẫu CV, ảnh người dùng tải lên) lên R2 thành
# application/octet-stream. Khai báo ở đây vì mọi tiến trình (web, worker, manage.py) đều nạp.
mimetypes.add_type('image/webp', '.webp')

STATIC_URL = 'static/'

# MEDIA_ROOT remains a compatibility alias for the public root. Sensitive and
# untrusted files have independent roots that are never served by web routes.
MEDIA_URL = '/media/'
PUBLIC_MEDIA_ROOT = Path(
    config('PUBLIC_MEDIA_ROOT', default=str(BASE_DIR / 'public-media')).strip()
).expanduser()
MEDIA_ROOT = PUBLIC_MEDIA_ROOT
PRIVATE_MEDIA_ROOT = Path(
    config('PRIVATE_MEDIA_ROOT', default=str(BASE_DIR / 'private-media')).strip()
).expanduser()
UPLOAD_QUARANTINE_ROOT = Path(
    config('UPLOAD_QUARANTINE_ROOT', default=str(BASE_DIR / 'quarantine')).strip()
).expanduser()
R2_ENDPOINT_URL = config('R2_ENDPOINT_URL', default='').strip()
R2_REGION_NAME = config('R2_REGION_NAME', default='auto').strip() or 'auto'
R2_PUBLIC_ACCESS_KEY_ID = config('R2_PUBLIC_ACCESS_KEY_ID', default='').strip()
R2_PUBLIC_SECRET_ACCESS_KEY = config('R2_PUBLIC_SECRET_ACCESS_KEY', default='').strip()
R2_PRIVATE_ACCESS_KEY_ID = config('R2_PRIVATE_ACCESS_KEY_ID', default='').strip()
R2_PRIVATE_SECRET_ACCESS_KEY = config('R2_PRIVATE_SECRET_ACCESS_KEY', default='').strip()
R2_QUARANTINE_ACCESS_KEY_ID = config('R2_QUARANTINE_ACCESS_KEY_ID', default='').strip()
R2_QUARANTINE_SECRET_ACCESS_KEY = config('R2_QUARANTINE_SECRET_ACCESS_KEY', default='').strip()
R2_PUBLIC_BUCKET = config('R2_PUBLIC_BUCKET', default='procv-public-media').strip()
R2_PRIVATE_BUCKET = config('R2_PRIVATE_BUCKET', default='procv-private-files').strip()
R2_QUARANTINE_BUCKET = config('R2_QUARANTINE_BUCKET', default='procv-upload-quarantine').strip()
R2_PUBLIC_BASE_URL = config('R2_PUBLIC_BASE_URL', default='').strip().rstrip('/')
R2_ENABLED = bool(
    R2_ENDPOINT_URL
    and R2_PUBLIC_ACCESS_KEY_ID
    and R2_PUBLIC_SECRET_ACCESS_KEY
    and R2_PRIVATE_ACCESS_KEY_ID
    and R2_PRIVATE_SECRET_ACCESS_KEY
    and R2_PUBLIC_BASE_URL
)
R2_QUARANTINE_ENABLED = bool(
    R2_ENABLED
    and R2_QUARANTINE_ACCESS_KEY_ID
    and R2_QUARANTINE_SECRET_ACCESS_KEY
    and R2_QUARANTINE_BUCKET
)

# Kept as a compatibility setting for media helpers and deployments that still
# use local disk.  With R2, URLs are produced by the public storage backend.
MEDIA_PUBLIC_BASE_URL = R2_PUBLIC_BASE_URL or config('MEDIA_PUBLIC_BASE_URL', default='').strip()
IMAGE_UPLOAD_MAX_SIZE = config('IMAGE_UPLOAD_MAX_SIZE', default=5 * 1024 * 1024, cast=int)

# Shared upload-session quarantine. The HTTP/service surface remains fail-closed
# until this flag is enabled with a real scanner and an explicit purpose allowlist.
UPLOAD_QUARANTINE_ENABLED = config('UPLOAD_QUARANTINE_ENABLED', default=False, cast=bool)
EMPLOYER_UPLOAD_SESSION_REQUIRED = config(
    'EMPLOYER_UPLOAD_SESSION_REQUIRED',
    default=False,
    cast=bool,
)
CANDIDATE_UPLOAD_SESSION_REQUIRED = config(
    'CANDIDATE_UPLOAD_SESSION_REQUIRED',
    default=False,
    cast=bool,
)
UPLOAD_SCANNER_BACKEND = config(
    'UPLOAD_SCANNER_BACKEND',
    default='apps.uploads.services.scanners.ClamAVStreamScanner',
).strip()
UPLOAD_SESSION_ALLOWED_PURPOSES = tuple(
    config(
        'UPLOAD_SESSION_ALLOWED_PURPOSES',
        default='employer_verification,employer_company_update,candidate_cv',
        cast=Csv(),
    )
)
UPLOAD_ALLOWED_CONTENT_TYPES = (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
)
UPLOAD_MAX_BYTES = config('UPLOAD_MAX_BYTES', default=25 * 1024 * 1024, cast=int)
UPLOAD_OWNER_MAX_ACTIVE_SESSIONS = config('UPLOAD_OWNER_MAX_ACTIVE_SESSIONS', default=10, cast=int)
UPLOAD_OWNER_MAX_ACTIVE_BYTES = config(
    'UPLOAD_OWNER_MAX_ACTIVE_BYTES', default=100 * 1024 * 1024, cast=int
)
UPLOAD_SPOOL_MEMORY_BYTES = config('UPLOAD_SPOOL_MEMORY_BYTES', default=5 * 1024 * 1024, cast=int)
UPLOAD_DOCX_MAX_ENTRIES = config('UPLOAD_DOCX_MAX_ENTRIES', default=500, cast=int)
UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES = config(
    'UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES', default=100 * 1024 * 1024, cast=int
)
UPLOAD_DOCX_MAX_COMPRESSION_RATIO = config(
    'UPLOAD_DOCX_MAX_COMPRESSION_RATIO', default=100, cast=float
)
UPLOAD_SESSION_TTL_SECONDS = config('UPLOAD_SESSION_TTL_SECONDS', default=86400, cast=int)
UPLOAD_WRITE_LEASE_SECONDS = config('UPLOAD_WRITE_LEASE_SECONDS', default=120, cast=int)
UPLOAD_SCAN_LEASE_SECONDS = config('UPLOAD_SCAN_LEASE_SECONDS', default=120, cast=int)
UPLOAD_SCAN_MAX_ATTEMPTS = config('UPLOAD_SCAN_MAX_ATTEMPTS', default=4, cast=int)
UPLOAD_SCAN_RETRY_BASE_SECONDS = config('UPLOAD_SCAN_RETRY_BASE_SECONDS', default=30, cast=int)
UPLOAD_CLEAN_RETENTION_DAYS = config('UPLOAD_CLEAN_RETENTION_DAYS', default=730, cast=int)
UPLOAD_EVIDENCE_RETENTION_DAYS = config('UPLOAD_EVIDENCE_RETENTION_DAYS', default=730, cast=int)
UPLOAD_CLEANUP_BATCH_SIZE = config('UPLOAD_CLEANUP_BATCH_SIZE', default=100, cast=int)
CLAMAV_HOST = config('CLAMAV_HOST', default='').strip()
CLAMAV_PORT = config('CLAMAV_PORT', default=3310, cast=int)
CLAMAV_CONNECT_TIMEOUT_SECONDS = config('CLAMAV_CONNECT_TIMEOUT_SECONDS', default=2, cast=float)
CLAMAV_READ_TIMEOUT_SECONDS = config('CLAMAV_READ_TIMEOUT_SECONDS', default=60, cast=float)
CLAMAV_STREAM_CHUNK_BYTES = config('CLAMAV_STREAM_CHUNK_BYTES', default=1024 * 1024, cast=int)

_LOCAL_MEDIA_STORAGE = {
    'BACKEND': 'django.core.files.storage.FileSystemStorage',
    'OPTIONS': {'location': PUBLIC_MEDIA_ROOT, 'base_url': MEDIA_URL},
}
_LOCAL_PRIVATE_MEDIA_STORAGE = {
    'BACKEND': 'common.storage.private.PrivateFileSystemStorage',
    'OPTIONS': {'location': PRIVATE_MEDIA_ROOT, 'base_url': None},
}
_LOCAL_QUARANTINE_STORAGE = {
    'BACKEND': 'common.storage.private.QuarantineFileSystemStorage',
    'OPTIONS': {'location': UPLOAD_QUARANTINE_ROOT, 'base_url': None},
}
STORAGES = {
    'default': _LOCAL_PRIVATE_MEDIA_STORAGE,
    'private_media': _LOCAL_PRIVATE_MEDIA_STORAGE,
    'quarantine': _LOCAL_QUARANTINE_STORAGE,
    'public_media': _LOCAL_MEDIA_STORAGE,
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
if R2_ENABLED:
    from botocore.config import Config as BotoConfig

    _R2_COMMON_OPTIONS = {
        'endpoint_url': R2_ENDPOINT_URL,
        'region_name': R2_REGION_NAME,
        'default_acl': None,
        'file_overwrite': False,
        # boto3 mặc định chờ 60 s mỗi lần + 4 lần thử: R2 chậm là luồng gunicorn treo vài phút.
        'client_config': BotoConfig(
            connect_timeout=5,
            read_timeout=30,
            retries={'max_attempts': 3, 'mode': 'standard'},
        ),
    }
    STORAGES['default'] = {
        'BACKEND': 'common.storage.private.PrivateS3Storage',
        'OPTIONS': {
            **_R2_COMMON_OPTIONS,
            'bucket_name': R2_PRIVATE_BUCKET,
            'access_key': R2_PRIVATE_ACCESS_KEY_ID,
            'secret_key': R2_PRIVATE_SECRET_ACCESS_KEY,
            'querystring_auth': False,
        },
    }
    STORAGES['private_media'] = STORAGES['default']
    if R2_QUARANTINE_ENABLED:
        STORAGES['quarantine'] = {
            'BACKEND': 'common.storage.private.QuarantineS3Storage',
            'OPTIONS': {
                **_R2_COMMON_OPTIONS,
                'bucket_name': R2_QUARANTINE_BUCKET,
                'access_key': R2_QUARANTINE_ACCESS_KEY_ID,
                'secret_key': R2_QUARANTINE_SECRET_ACCESS_KEY,
                'querystring_auth': True,
            },
        }
    STORAGES['public_media'] = {
        'BACKEND': 'storages.backends.s3.S3Storage',
        'OPTIONS': {
            **_R2_COMMON_OPTIONS,
            'bucket_name': R2_PUBLIC_BUCKET,
            'access_key': R2_PUBLIC_ACCESS_KEY_ID,
            'secret_key': R2_PUBLIC_SECRET_ACCESS_KEY,
            'custom_domain': R2_PUBLIC_BASE_URL.removeprefix('https://').removeprefix('http://'),
            'querystring_auth': False,
            'object_parameters': {'CacheControl': 'public, max-age=31536000, immutable'},
        },
    }

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
