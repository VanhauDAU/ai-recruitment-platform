"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.
DJANGO_SETTINGS_MODULE phải được đặt tường minh (kiểm ở ``config/celery.py``).

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

from django.core.asgi import get_asgi_application

application = get_asgi_application()
