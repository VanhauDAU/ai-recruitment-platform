"""Production-only validation and security policy."""

from django.core.exceptions import ImproperlyConfigured

from decouple import config

from .base import *  # noqa: F403
from .base import _DEFAULT_SECRET_KEY


if not IS_PRODUCTION:  # noqa: F405
    raise ImproperlyConfigured(
        'config.settings.production yêu cầu ENVIRONMENT=production.',
    )

if DEBUG:  # noqa: F405
    raise ImproperlyConfigured('DEBUG phải là False khi ENVIRONMENT=production.')
if SECRET_KEY == _DEFAULT_SECRET_KEY:  # noqa: F405
    raise ImproperlyConfigured('SECRET_KEY production phải được cấu hình qua biến môi trường.')
if set(ALLOWED_HOSTS).issubset({'localhost', '127.0.0.1'}):  # noqa: F405
    raise ImproperlyConfigured('ALLOWED_HOSTS production phải chứa domain hợp lệ.')
if not RECAPTCHA_SECRET_KEY:  # noqa: F405
    raise ImproperlyConfigured('RECAPTCHA_SECRET_KEY là bắt buộc ở production.')

jwt_signing_key = config('JWT_SIGNING_KEY', default='')
if not jwt_signing_key:
    raise ImproperlyConfigured('JWT_SIGNING_KEY là bắt buộc khi ENVIRONMENT=production.')
if len(jwt_signing_key) < 32:
    raise ImproperlyConfigured('JWT_SIGNING_KEY production phải có ít nhất 32 ký tự.')

if not R2_ENABLED:  # noqa: F405
    raise ImproperlyConfigured(
        'Production yêu cầu Cloudflare R2: endpoint, access key, secret key và public base URL.',
    )
if not AUTH_REFRESH_COOKIE_SECURE:  # noqa: F405
    raise ImproperlyConfigured('AUTH_REFRESH_COOKIE_SECURE phải bật ở production.')
if AUTH_REFRESH_COOKIE_SAMESITE not in {'Lax', 'Strict'}:  # noqa: F405
    raise ImproperlyConfigured(
        'Refresh cookie production phải dùng SameSite=Lax hoặc Strict.',
    )
