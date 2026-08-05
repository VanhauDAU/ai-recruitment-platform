"""Fast, isolated settings for Django's test runner and CI."""

from .base import *

ENVIRONMENT = 'test'
IS_PRODUCTION = False
DEBUG = False
DJANGO_ADMIN_ENABLED = False
R2_ENABLED = False
KNOWLEDGEBASE_PUBLIC_ENABLED = True
R2_PUBLIC_BASE_URL = ''
MEDIA_PUBLIC_BASE_URL = ''

# Test cryptography must be deterministic and independent from a developer's
# local .env. Keep both Django and SimpleJWT on the same sufficiently long key.
SECRET_KEY = 'test-only-secret-key-at-least-32-characters-long'
SIMPLE_JWT = {**SIMPLE_JWT, 'SIGNING_KEY': SECRET_KEY}

# Never let a local .env switch test storage to a real R2 bucket. Tests use the
# same local media contract as before and must not require network credentials.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': MEDIA_ROOT, 'base_url': MEDIA_URL},
    },
    'public_media': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': MEDIA_ROOT, 'base_url': MEDIA_URL},
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

# Announcement tests exercise every surface by default. Individual kill-switch
# tests override this setting explicitly.
ANNOUNCEMENT_REMOTE_ENABLED_SURFACES = (
    'candidate',
    'employer_marketing',
    'employer_workspace',
    'admin_workspace',
)

# These flags must never redirect the Django test client away from HTTP routes.
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = None
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
