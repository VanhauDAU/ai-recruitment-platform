"""Production-only validation and security policy.

Fail-fast: gom TẤT CẢ lỗi cấu hình rồi raise một lần — vận hành sửa được hết
trong một lượt deploy thay vì gặp từng lỗi một.
"""

from django.core.exceptions import ImproperlyConfigured

from decouple import config

from .base import *  # noqa: F403
from .base import _DEFAULT_SECRET_KEY

_errors: list[str] = []

if not IS_PRODUCTION:  # noqa: F405
    _errors.append('config.settings.production yêu cầu ENVIRONMENT=production.')

if DEBUG:  # noqa: F405
    _errors.append('DEBUG phải là False khi ENVIRONMENT=production.')
if SECRET_KEY == _DEFAULT_SECRET_KEY:  # noqa: F405
    _errors.append('SECRET_KEY production phải được cấu hình qua biến môi trường.')
if set(ALLOWED_HOSTS).issubset({'localhost', '127.0.0.1'}):  # noqa: F405
    _errors.append('ALLOWED_HOSTS production phải chứa domain hợp lệ.')
if not RECAPTCHA_SECRET_KEY:  # noqa: F405
    _errors.append('RECAPTCHA_SECRET_KEY là bắt buộc ở production.')

jwt_signing_key = config('JWT_SIGNING_KEY', default='')
if not jwt_signing_key:
    _errors.append('JWT_SIGNING_KEY là bắt buộc khi ENVIRONMENT=production.')
elif len(jwt_signing_key) < 32:
    _errors.append('JWT_SIGNING_KEY production phải có ít nhất 32 ký tự.')

if DATABASES['default']['PASSWORD'] in {'', 'postgres'}:  # noqa: F405
    _errors.append('DB_PASSWORD production không được để trống hoặc dùng default "postgres".')

if not CORS_ALLOWED_ORIGINS:  # noqa: F405
    _errors.append('CORS_ALLOWED_ORIGINS là bắt buộc ở production (origin frontend).')

if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:  # noqa: F405
    _errors.append('EMAIL_HOST_USER / EMAIL_HOST_PASSWORD là bắt buộc ở production.')

if not R2_ENABLED:  # noqa: F405
    _errors.append(
        'Production yêu cầu Cloudflare R2: endpoint, access key, secret key và public base URL.',
    )
if not AUTH_REFRESH_COOKIE_SECURE:  # noqa: F405
    _errors.append('AUTH_REFRESH_COOKIE_SECURE phải bật ở production.')
if AUTH_REFRESH_COOKIE_SAMESITE not in {'Lax', 'Strict'}:  # noqa: F405
    _errors.append('Refresh cookie production phải dùng SameSite=Lax hoặc Strict.')

if _errors:
    raise ImproperlyConfigured(
        'Cấu hình production thiếu/sai %d mục:\n- %s' % (len(_errors), '\n- '.join(_errors)),
    )
