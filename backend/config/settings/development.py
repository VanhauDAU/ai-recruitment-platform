"""Local development settings; this is the default Django entry point."""

from django.core.exceptions import ImproperlyConfigured

from .base import *

if IS_PRODUCTION:
    raise ImproperlyConfigured(
        'ENVIRONMENT=production phải dùng DJANGO_SETTINGS_MODULE=config.settings.production.',
    )
