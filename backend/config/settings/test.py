"""Fast, isolated settings for Django's test runner and CI."""

from .base import *

ENVIRONMENT = 'test'
IS_PRODUCTION = False
DEBUG = False
DJANGO_ADMIN_ENABLED = False
R2_ENABLED = False
KNOWLEDGEBASE_PUBLIC_ENABLED = True
KNOWLEDGEBASE_SEARCH_INDEX_ENABLED = False
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
        'BACKEND': 'common.private_storage.PrivateFileSystemStorage',
        'OPTIONS': {'location': PRIVATE_MEDIA_ROOT, 'base_url': None},
    },
    'private_media': {
        'BACKEND': 'common.private_storage.PrivateFileSystemStorage',
        'OPTIONS': {'location': PRIVATE_MEDIA_ROOT, 'base_url': None},
    },
    'quarantine': {
        'BACKEND': 'common.private_storage.QuarantineFileSystemStorage',
        'OPTIONS': {'location': UPLOAD_QUARANTINE_ROOT, 'base_url': None},
    },
    'public_media': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': PUBLIC_MEDIA_ROOT, 'base_url': MEDIA_URL},
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
UPLOAD_QUARANTINE_ENABLED = True
UPLOAD_SCANNER_BACKEND = 'apps.uploads.tests.fakes.FakeUploadScanner'
UPLOAD_SESSION_ALLOWED_PURPOSES = (
    'employer_verification',
    'employer_company_update',
    'candidate_cv',
)
UPLOAD_SCAN_RETRY_BASE_SECONDS = 1
EMPLOYER_DPA_POLICY_VERSION = 'test-dpa-v1'
EMPLOYER_DPA_DOCUMENT_SHA256 = 'a' * 64
EMPLOYER_DPA_DOCUMENT_URL = 'https://example.test/employer-dpa/test-dpa-v1'

# Behaviour flags must be deterministic in tests.  The base settings load a
# developer's ``backend/.env`` before this module, so leaving these values
# unpinned makes the same suite pass or fail depending on which pilot features
# happen to be enabled locally.  Tests for an enabled feature opt in explicitly
# with ``override_settings``.
EMPLOYER_DPA_GRACE_DAYS = 30
EMPLOYER_UPLOAD_SESSION_REQUIRED = False
CANDIDATE_UPLOAD_SESSION_REQUIRED = False
JOB_LIFECYCLE_V2_MODE = 'legacy'
EMPLOYER_BADGE_POLICY_MODE = 'enforce'
JOB_PRESENTATION_V2_ENABLED = False
SERVICE_CATALOG_V2_ENABLED = False
SERVICE_ACTIVATION_ENABLED = False
SPONSORED_JOB_DISTRIBUTION_ENABLED = False
JOB_PROMOTION_REFRESH_ENABLED = False
JOB_PROMOTION_ALERT_ENABLED = False
JOB_PROMOTION_METRICS_ENABLED = False
SAVED_JOB_REMARKETING_ENABLED = False

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
