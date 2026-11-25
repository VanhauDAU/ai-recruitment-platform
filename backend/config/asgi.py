"""
ASGI config: Django HTTP và WebSocket thông báo (``apps.realtime``).

Production chạy process ``realtime`` (daphne) chỉ nhận ``/ws/``; HTTP vẫn qua
gunicorn. Dev ``runserver`` (có ``daphne`` trong INSTALLED_APPS) phục vụ cả hai.
DJANGO_SETTINGS_MODULE phải được đặt tường minh (kiểm ở ``config/celery.py``).
"""

from django.core.asgi import get_asgi_application

# Django phải khởi tạo trước khi import consumer (model, settings).
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.realtime.api.routing import websocket_urlpatterns  # noqa: E402
from common.http.websocket import SameOriginWebsocketGuard  # noqa: E402

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': SameOriginWebsocketGuard(URLRouter(websocket_urlpatterns)),
    }
)
