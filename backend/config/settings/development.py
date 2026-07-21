"""Local development settings; this is the default Django entry point."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

if IS_PRODUCTION:  # noqa: F405
    raise ImproperlyConfigured(
        'ENVIRONMENT=production phải dùng DJANGO_SETTINGS_MODULE=config.settings.production.',
    )
