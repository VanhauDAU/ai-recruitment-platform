"""CORS, header bảo mật, cookie phiên/refresh, chống dò mật khẩu."""

from corsheaders.defaults import default_headers
from decouple import Csv

from config.env import config

from .core import IS_PRODUCTION

# CORS - frontend dev server (Vite default port)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True
# Autosave and version operations use optimistic locking via If-Match.
# Include it in the preflight allow-list so browsers can send those requests
# from the Vite development origin.
CORS_ALLOW_HEADERS = (*default_headers, 'if-match', 'x-auth-portal', 'x-session-probe')
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

# Consent is stored in a signed, HttpOnly first-party cookie.  The browser may
# retain a non-sensitive mirror only to render the UI, but the backend cookie is
# always the source of truth for analytics processing.
# SecurityMiddleware protects Django Admin/session cookies as well as API responses.
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=IS_PRODUCTION, cast=bool)
SECURE_PROXY_SSL_HEADER = (
    ('HTTP_X_FORWARDED_PROTO', 'https')
    if config('SECURE_PROXY_SSL_HEADER_ENABLED', default=IS_PRODUCTION, cast=bool)
    else None
)
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=IS_PRODUCTION, cast=bool)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=IS_PRODUCTION, cast=bool)
SESSION_COOKIE_HTTPONLY = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = config(
    'SECURE_HSTS_SECONDS', default=31_536_000 if IS_PRODUCTION else 0, cast=int
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config(
    'SECURE_HSTS_INCLUDE_SUBDOMAINS', default=IS_PRODUCTION, cast=bool
)
SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=False, cast=bool)
X_FRAME_OPTIONS = 'DENY'

# Refresh JWT never enters JavaScript storage.  It is isolated per portal in an
# HttpOnly cookie; access JWTs remain short-lived and can be reconstructed after
# a reload through the cookie-backed refresh endpoint.
AUTH_REFRESH_COOKIE_PREFIX = config('AUTH_REFRESH_COOKIE_PREFIX', default='procv_refresh')
AUTH_REFRESH_COOKIE_SECURE = config('AUTH_REFRESH_COOKIE_SECURE', default=IS_PRODUCTION, cast=bool)
AUTH_REFRESH_COOKIE_SAMESITE = config('AUTH_REFRESH_COOKIE_SAMESITE', default='Lax')
AUTH_REFRESH_COOKIE_DOMAIN = config('AUTH_REFRESH_COOKIE_DOMAIN', default='') or None
AUTH_REFRESH_COOKIE_PATH = config('AUTH_REFRESH_COOKIE_PATH', default='/api/')
AUTH_SESSION_TOUCH_INTERVAL_SECONDS = config(
    'AUTH_SESSION_TOUCH_INTERVAL_SECONDS',
    default=5 * 60,
    cast=int,
)
AUTH_REAUTH_MAX_AGE_SECONDS = config('AUTH_REAUTH_MAX_AGE_SECONDS', default=5 * 60, cast=int)
# Ân hạn cho refresh token vừa bị xoay vòng: trong ngần này giây, việc gặp lại
# nó được coi là đua giữa hai tab / đăng nhập lại chứ không phải token bị trộm.
AUTH_REFRESH_REUSE_GRACE_SECONDS = config('AUTH_REFRESH_REUSE_GRACE_SECONDS', default=30, cast=int)

# Chống dò mật khẩu theo từng tài khoản: sau ngần này lần sai, mỗi lần kế tiếp
# phải chờ gấp đôi lần trước (không khoá cứng — xem services/login_guard.py).
LOGIN_BACKOFF_FREE_ATTEMPTS = config('LOGIN_BACKOFF_FREE_ATTEMPTS', default=5, cast=int)
LOGIN_BACKOFF_BASE_SECONDS = config('LOGIN_BACKOFF_BASE_SECONDS', default=2, cast=int)
LOGIN_BACKOFF_MAX_SECONDS = config('LOGIN_BACKOFF_MAX_SECONDS', default=15 * 60, cast=int)
LOGIN_BACKOFF_WINDOW_SECONDS = config('LOGIN_BACKOFF_WINDOW_SECONDS', default=15 * 60, cast=int)
