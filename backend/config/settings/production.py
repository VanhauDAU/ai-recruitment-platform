"""Production-only validation and security policy.

Fail-fast: gom TẤT CẢ lỗi cấu hình rồi raise một lần — vận hành sửa được hết
trong một lượt deploy thay vì gặp từng lỗi một.
"""

from urllib.parse import urlparse

from cryptography.fernet import Fernet
from decouple import config
from django.core.exceptions import ImproperlyConfigured

from apps.uploads.configuration import upload_scanning_configuration_errors
from common.private_storage import storage_boundary_configuration_errors

from .base import *
from .base import _DEFAULT_SECRET_KEY

_errors: list[str] = []

# Production defaults to the enforced workflow. Operators may still use an
# explicit false value for a controlled rollback.
REQUIRE_APPROVED_EMPLOYER_VERIFICATION = config(
    'REQUIRE_APPROVED_EMPLOYER_VERIFICATION',
    default=True,
    cast=bool,
)
REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS = config(
    'REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS',
    default=True,
    cast=bool,
)

if not IS_PRODUCTION:
    _errors.append('config.settings.production yêu cầu ENVIRONMENT=production.')

if DEBUG:
    _errors.append('DEBUG phải là False khi ENVIRONMENT=production.')
if DJANGO_ADMIN_ENABLED:
    _errors.append('DJANGO_ADMIN_ENABLED phải là False khi ENVIRONMENT=production.')
if SECRET_KEY == _DEFAULT_SECRET_KEY:
    _errors.append('SECRET_KEY production phải được cấu hình qua biến môi trường.')
if set(ALLOWED_HOSTS).issubset({'localhost', '127.0.0.1'}):
    _errors.append('ALLOWED_HOSTS production phải chứa domain hợp lệ.')
if not RECAPTCHA_SECRET_KEY:
    _errors.append('RECAPTCHA_SECRET_KEY là bắt buộc ở production.')
if SPEECH_TTS_INTERNAL_TOKEN in {'', 'dev-tts-internal-token-change-me'}:
    _errors.append('SPEECH_TTS_INTERNAL_TOKEN production phải là secret riêng.')

if not 1 <= JOB_POSTING_DEFAULT_DEADLINE_DAYS <= JOB_POSTING_MAX_DEADLINE_DAYS:
    _errors.append('JOB_POSTING_DEFAULT_DEADLINE_DAYS phải từ 1 đến JOB_POSTING_MAX_DEADLINE_DAYS.')
if JOB_POSTING_MAX_DEADLINE_DAYS > JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS:
    _errors.append('JOB_POSTING_MAX_DEADLINE_DAYS không được vượt quá vòng đời công khai tối đa.')
if JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS > 90:
    _errors.append('JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS không được vượt quá 90 ngày.')
if JOB_LIFECYCLE_V2_MODE not in {'legacy', 'shadow', 'enforce'}:
    _errors.append('JOB_LIFECYCLE_V2_MODE phải là legacy, shadow hoặc enforce.')

_ai_provider_backends = {'gemini_developer', 'vertex'}
if AI_PROVIDER_BACKEND not in _ai_provider_backends:
    _errors.append(
        'AI_PROVIDER_BACKEND phải là gemini_developer hoặc vertex; không có fallback provider.'
    )
if not AI_JOB_GENERATION_MODEL_ALLOWLIST:
    _errors.append('AI_JOB_GENERATION_MODEL_ALLOWLIST phải có ít nhất một model đã duyệt.')
elif AI_JOB_GENERATION_MODEL not in AI_JOB_GENERATION_MODEL_ALLOWLIST:
    _errors.append('AI_JOB_GENERATION_MODEL phải nằm trong model allowlist production.')
if AI_JOB_GENERATION_DAILY_LIMIT <= 0:
    _errors.append('AI_JOB_GENERATION_DAILY_LIMIT phải lớn hơn 0.')
if AI_PROVIDER_TIMEOUT_SECONDS <= 0 or AI_PROVIDER_TIMEOUT_SECONDS > 40:
    _errors.append('AI_PROVIDER_TIMEOUT_SECONDS phải trong khoảng (0, 40].')
if AI_PROVIDER_MAX_ATTEMPTS not in {1, 2}:
    _errors.append('AI_PROVIDER_MAX_ATTEMPTS chỉ được là 1 hoặc 2.')
if AI_PROVIDER_RETRY_BASE_SECONDS <= 0 or AI_PROVIDER_RETRY_BASE_SECONDS > 5:
    _errors.append('AI_PROVIDER_RETRY_BASE_SECONDS phải trong khoảng (0, 5].')
if AI_JOB_GENERATION_LEASE_SECONDS != 85:
    _errors.append('AI_JOB_GENERATION_LEASE_SECONDS production phải là 85 giây.')
if AI_JOB_GENERATION_CONTENT_RETENTION_DAYS != 90:
    _errors.append('Nội dung AI job generation production phải giữ đúng 90 ngày.')
if AI_INVOCATION_METADATA_RETENTION_DAYS != 365:
    _errors.append('Metadata AI production phải giữ đúng 365 ngày.')
if AI_RUNTIME_ENABLED:
    _model_pricing = (
        AI_MODEL_PRICING_USD.get(AI_JOB_GENERATION_MODEL)
        if isinstance(AI_MODEL_PRICING_USD, dict)
        else None
    )
    if not isinstance(_model_pricing, dict) or not {'input', 'output'} <= set(_model_pricing):
        _errors.append('AI_MODEL_PRICING_USD phải có giá input/output cho model đang bật.')
    else:
        try:
            _pricing_values = [float(_model_pricing['input']), float(_model_pricing['output'])]
        except (TypeError, ValueError):
            _errors.append('Giá token AI_MODEL_PRICING_USD phải là số.')
        else:
            if any(value < 0 for value in _pricing_values) or not any(_pricing_values):
                _errors.append('Giá token AI phải không âm và có ít nhất một giá lớn hơn 0.')
    if AI_PROVIDER_BACKEND == 'gemini_developer' and not GEMINI_API_KEY:
        _errors.append('GEMINI_API_KEY là bắt buộc khi bật Gemini Developer API.')
    if AI_PROVIDER_BACKEND == 'vertex':
        if not GOOGLE_CLOUD_PROJECT:
            _errors.append('GOOGLE_CLOUD_PROJECT là bắt buộc khi bật Vertex AI.')
        if not GOOGLE_CLOUD_LOCATION:
            _errors.append('GOOGLE_CLOUD_LOCATION là bắt buộc khi bật Vertex AI.')

_announcement_surfaces = {
    'candidate',
    'employer_marketing',
    'employer_workspace',
    'admin_workspace',
}
_invalid_announcement_surfaces = set(ANNOUNCEMENT_REMOTE_ENABLED_SURFACES) - _announcement_surfaces
if _invalid_announcement_surfaces:
    _errors.append(
        'ANNOUNCEMENT_REMOTE_ENABLED_SURFACES chứa surface không hợp lệ: '
        + ', '.join(sorted(_invalid_announcement_surfaces))
        + '.',
    )

jwt_signing_key = config('JWT_SIGNING_KEY', default='')
if not jwt_signing_key:
    _errors.append('JWT_SIGNING_KEY là bắt buộc khi ENVIRONMENT=production.')
elif len(jwt_signing_key) < 32:
    _errors.append('JWT_SIGNING_KEY production phải có ít nhất 32 ký tự.')

if DATABASES['default']['PASSWORD'] in {'', 'postgres'}:
    _errors.append('DB_PASSWORD production không được để trống hoặc dùng default "postgres".')

if not CORS_ALLOWED_ORIGINS:
    _errors.append('CORS_ALLOWED_ORIGINS là bắt buộc ở production (origin frontend).')

if not TRUSTED_PROXY_IPS:
    # Production luôn chạy sau reverse proxy, nên REMOTE_ADDR là địa chỉ của
    # proxy — giống hệt nhau với mọi người dùng. Không khai proxy tin cậy thì
    # không cách nào biết IP client thật: rate limit đăng nhập gộp chung cả hệ
    # thống vào một bucket và danh sách thiết bị hiện sai IP.
    _errors.append(
        'TRUSTED_PROXY_IPS là bắt buộc ở production (dải IP của reverse proxy).',
    )

if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
    _errors.append('EMAIL_HOST_USER / EMAIL_HOST_PASSWORD là bắt buộc ở production.')

if not EMPLOYER_DPA_POLICY_VERSION:
    _errors.append('EMPLOYER_DPA_POLICY_VERSION là bắt buộc ở production.')
if len(EMPLOYER_DPA_DOCUMENT_SHA256) != 64 or any(
    character not in '0123456789abcdef' for character in EMPLOYER_DPA_DOCUMENT_SHA256
):
    _errors.append('EMPLOYER_DPA_DOCUMENT_SHA256 phải là SHA-256 lowercase hợp lệ.')
if urlparse(EMPLOYER_DPA_DOCUMENT_URL).scheme != 'https':
    _errors.append('EMPLOYER_DPA_DOCUMENT_URL production phải dùng HTTPS.')
if EMPLOYER_DPA_GRACE_DAYS != 30:
    _errors.append('EMPLOYER_DPA_GRACE_DAYS production phải đúng quyết định 30 ngày.')

if EMPLOYER_SMS_OTP_ENABLED:
    if EMPLOYER_SMS_PROVIDER != 'http':
        _errors.append('EMPLOYER_SMS_PROVIDER production phải là http khi bật SMS.')
    if not EMPLOYER_SMS_ENDPOINT_URL:
        _errors.append('EMPLOYER_SMS_ENDPOINT_URL là bắt buộc khi bật SMS.')
    elif urlparse(EMPLOYER_SMS_ENDPOINT_URL).scheme != 'https':
        _errors.append('EMPLOYER_SMS_ENDPOINT_URL production phải dùng HTTPS.')
    if not EMPLOYER_SMS_API_TOKEN:
        _errors.append('EMPLOYER_SMS_API_TOKEN là bắt buộc khi bật SMS.')
    if not EMPLOYER_SMS_SENDER:
        _errors.append('EMPLOYER_SMS_SENDER là bắt buộc khi bật SMS.')
    if not EMPLOYER_SMS_TEMPLATE_ID:
        _errors.append('EMPLOYER_SMS_TEMPLATE_ID là bắt buộc khi bật SMS.')
    if not EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY:
        _errors.append('EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY là bắt buộc khi bật SMS.')
    else:
        try:
            Fernet(EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY.encode())
        except (TypeError, ValueError):
            _errors.append('EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY không hợp lệ.')
        if EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY in {
            SECRET_KEY,
            SIMPLE_JWT.get('SIGNING_KEY', ''),
            TWO_FACTOR_TOTP_ENCRYPTION_KEY,
        } - {''}:
            _errors.append(
                'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY không được dùng lại secret hệ thống khác.'
            )
    if len(EMPLOYER_SMS_CHALLENGE_HMAC_KEY) < 32:
        _errors.append('EMPLOYER_SMS_CHALLENGE_HMAC_KEY phải có ít nhất 32 ký tự.')
    elif EMPLOYER_SMS_CHALLENGE_HMAC_KEY in {
        SECRET_KEY,
        SIMPLE_JWT.get('SIGNING_KEY', ''),
        TWO_FACTOR_TOTP_ENCRYPTION_KEY,
        EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY,
    } - {''}:
        _errors.append('EMPLOYER_SMS_CHALLENGE_HMAC_KEY không được dùng lại secret hệ thống khác.')
    if EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS <= 0 or EMPLOYER_SMS_READ_TIMEOUT_SECONDS <= 0:
        _errors.append('Timeout SMS phải lớn hơn 0.')

if not R2_ENABLED:
    _errors.append(
        'Production yêu cầu Cloudflare R2: endpoint, access key, secret key và public base URL.',
    )
_errors.extend(
    storage_boundary_configuration_errors(
        public_root=PUBLIC_MEDIA_ROOT,
        private_root=PRIVATE_MEDIA_ROOT,
        quarantine_root=UPLOAD_QUARANTINE_ROOT,
        legacy_root=LEGACY_MEDIA_ROOT,
        r2_enabled=R2_ENABLED,
        r2_quarantine_enabled=R2_QUARANTINE_ENABLED,
        r2_buckets=(R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET, R2_QUARANTINE_BUCKET),
        r2_credential_pairs=(
            (R2_PUBLIC_ACCESS_KEY_ID, R2_PUBLIC_SECRET_ACCESS_KEY),
            (R2_PRIVATE_ACCESS_KEY_ID, R2_PRIVATE_SECRET_ACCESS_KEY),
            (R2_QUARANTINE_ACCESS_KEY_ID, R2_QUARANTINE_SECRET_ACCESS_KEY),
        ),
    )
)
_errors.extend(
    upload_scanning_configuration_errors(
        enabled=UPLOAD_QUARANTINE_ENABLED,
        backend=UPLOAD_SCANNER_BACKEND,
        allowed_purposes=UPLOAD_SESSION_ALLOWED_PURPOSES,
        clamav_host=CLAMAV_HOST,
        clamav_port=CLAMAV_PORT,
        max_bytes=UPLOAD_MAX_BYTES,
        owner_max_active_sessions=UPLOAD_OWNER_MAX_ACTIVE_SESSIONS,
        owner_max_active_bytes=UPLOAD_OWNER_MAX_ACTIVE_BYTES,
        docx_max_entries=UPLOAD_DOCX_MAX_ENTRIES,
        docx_max_uncompressed_bytes=UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES,
        docx_max_compression_ratio=UPLOAD_DOCX_MAX_COMPRESSION_RATIO,
        spool_memory_bytes=UPLOAD_SPOOL_MEMORY_BYTES,
        session_ttl_seconds=UPLOAD_SESSION_TTL_SECONDS,
        write_lease_seconds=UPLOAD_WRITE_LEASE_SECONDS,
        scan_lease_seconds=UPLOAD_SCAN_LEASE_SECONDS,
        scan_max_attempts=UPLOAD_SCAN_MAX_ATTEMPTS,
        scan_retry_base_seconds=UPLOAD_SCAN_RETRY_BASE_SECONDS,
        clean_retention_days=UPLOAD_CLEAN_RETENTION_DAYS,
        evidence_retention_days=UPLOAD_EVIDENCE_RETENTION_DAYS,
        cleanup_batch_size=UPLOAD_CLEANUP_BATCH_SIZE,
        clamav_connect_timeout_seconds=CLAMAV_CONNECT_TIMEOUT_SECONDS,
        clamav_read_timeout_seconds=CLAMAV_READ_TIMEOUT_SECONDS,
        clamav_stream_chunk_bytes=CLAMAV_STREAM_CHUNK_BYTES,
        production=True,
    )
)
if EMPLOYER_UPLOAD_SESSION_REQUIRED and not UPLOAD_QUARANTINE_ENABLED:
    _errors.append(
        'EMPLOYER_UPLOAD_SESSION_REQUIRED chỉ được bật khi upload quarantine đã sẵn sàng.'
    )
if CANDIDATE_UPLOAD_SESSION_REQUIRED and not UPLOAD_QUARANTINE_ENABLED:
    _errors.append(
        'CANDIDATE_UPLOAD_SESSION_REQUIRED chỉ được bật khi upload quarantine đã sẵn sàng.'
    )
if CANDIDATE_UPLOAD_SESSION_REQUIRED and 'candidate_cv' not in UPLOAD_SESSION_ALLOWED_PURPOSES:
    _errors.append('CANDIDATE_UPLOAD_SESSION_REQUIRED cần allowlist purpose candidate_cv.')
if not AUTH_REFRESH_COOKIE_SECURE:
    _errors.append('AUTH_REFRESH_COOKIE_SECURE phải bật ở production.')
if AUTH_REFRESH_COOKIE_SAMESITE not in {'Lax', 'Strict'}:
    _errors.append('Refresh cookie production phải dùng SameSite=Lax hoặc Strict.')

if _errors:
    raise ImproperlyConfigured(
        f'Cấu hình production thiếu/sai {len(_errors)} mục:\n- ' + '\n- '.join(_errors),
    )
