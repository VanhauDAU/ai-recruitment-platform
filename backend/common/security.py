"""HTTP response headers for API endpoints.

Frontend CSP should be configured by its hosting layer because it loads scripts
and styles from its own origin. The API can safely use a restrictive policy.
"""

from urllib.parse import urlsplit

from django.conf import settings
from django.http import JsonResponse


class AuthCookieOriginMiddleware:
    """Reject cross-origin writes to endpoints that mint or rotate auth cookies."""

    _PATHS = {
        '/api/auth/register/',
        '/api/auth/login/',
        '/api/auth/logout/',
        '/api/auth/logout-all/',
        '/api/auth/refresh/',
        '/api/auth/oauth/complete/',
        '/api/auth/two-factor/login/verify/',
        '/api/auth/password/',
        '/api/employer/register/',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _origin(url):
        parsed = urlsplit(url)
        return f'{parsed.scheme}://{parsed.netloc}' if parsed.scheme and parsed.netloc else ''

    def __call__(self, request):
        origin = request.headers.get('Origin')
        if request.method not in {'GET', 'HEAD', 'OPTIONS'} and request.path in self._PATHS and origin:
            trusted = {
                *settings.CORS_ALLOWED_ORIGINS,
                *settings.CSRF_TRUSTED_ORIGINS,
                self._origin(settings.FRONTEND_URL),
                self._origin(settings.EMPLOYER_FRONTEND_URL),
            }
            if origin not in trusted:
                return JsonResponse(
                    {'detail': 'Nguồn yêu cầu không được phép.'},
                    status=403,
                )
        return self.get_response(request)


class ApiSecurityHeadersMiddleware:
    """Apply baseline browser protections without breaking Swagger/ReDoc."""

    _API_DOCUMENTATION_PATHS = {'/api/docs/', '/api/redoc/', '/api/schema/'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

        if request.path.startswith('/api/') and request.path not in self._API_DOCUMENTATION_PATHS:
            response.setdefault(
                'Content-Security-Policy',
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
        return response
