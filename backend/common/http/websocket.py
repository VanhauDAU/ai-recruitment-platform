"""Handshake guard for websocket routes (domain-agnostic)."""

from urllib.parse import urlsplit

from channels.security.websocket import WebsocketDenier
from django.conf import settings


def _origin_allowed(scope):
    headers = dict(scope.get('headers', []))
    origin = headers.get(b'origin', b'').decode('latin1')
    host = headers.get(b'host', b'').decode('latin1')
    if not origin:
        return False
    if urlsplit(origin).netloc == host:
        return True
    return origin in set(settings.CORS_ALLOWED_ORIGINS)


class SameOriginWebsocketGuard:
    """Refuse cross-site handshakes: same host as the page, or a CORS origin.

    Authentication is the one-time ticket; this only stops another site from
    opening sockets in a visitor's browser (defense in depth).
    """

    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'websocket' and not _origin_allowed(scope):
            return await WebsocketDenier()(scope, receive, send)
        return await self.application(scope, receive, send)
