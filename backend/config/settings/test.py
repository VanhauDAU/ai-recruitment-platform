"""Fast, isolated settings for Django's test runner and CI."""

from .base import *  # noqa: F403

ENVIRONMENT = 'test'
IS_PRODUCTION = False
DEBUG = False
R2_ENABLED = False
R2_PUBLIC_BASE_URL = ''
MEDIA_PUBLIC_BASE_URL = ''

# Never let a local .env switch test storage to a real R2 bucket. Tests use the
# same local media contract as before and must not require network credentials.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': MEDIA_ROOT, 'base_url': MEDIA_URL},  # noqa: F405
    },
    'public_media': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': MEDIA_ROOT, 'base_url': MEDIA_URL},  # noqa: F405
    },
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}

# Tests must not depend on a developer's Redis, SMTP server, or Celery worker.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'procv-tests',
    },
}
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# These flags must never redirect the Django test client away from HTTP routes.
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = None
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
