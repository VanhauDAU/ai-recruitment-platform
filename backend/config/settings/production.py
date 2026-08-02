"""Production-only validation and security policy.

Fail-fast: gom TẤT CẢ lỗi cấu hình rồi raise một lần — vận hành sửa được hết
trong một lượt deploy thay vì gặp từng lỗi một.
"""

from decouple import config
from django.core.exceptions import ImproperlyConfigured

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

if not R2_ENABLED:
    _errors.append(
        'Production yêu cầu Cloudflare R2: endpoint, access key, secret key và public base URL.',
    )
if not AUTH_REFRESH_COOKIE_SECURE:
    _errors.append('AUTH_REFRESH_COOKIE_SECURE phải bật ở production.')
if AUTH_REFRESH_COOKIE_SAMESITE not in {'Lax', 'Strict'}:
    _errors.append('Refresh cookie production phải dùng SameSite=Lax hoặc Strict.')

if _errors:
    raise ImproperlyConfigured(
        f'Cấu hình production thiếu/sai {len(_errors)} mục:\n- ' + '\n- '.join(_errors),
    )
