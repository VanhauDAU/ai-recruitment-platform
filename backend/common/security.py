"""HTTP response headers for API endpoints.

Frontend CSP should be configured by its hosting layer because it loads scripts
and styles from its own origin. The API can safely use a restrictive policy.
"""


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
