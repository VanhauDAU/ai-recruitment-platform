"""Tham số nghiệp vụ: consent, thông báo đa cổng, lượt xem tin, chính sách tin."""

from decouple import Csv

from config.env import config

from .core import IS_PRODUCTION

CONSENT_POLICY_VERSION = config('CONSENT_POLICY_VERSION', default=1, cast=int)
CONSENT_COOKIE_NAME = config('CONSENT_COOKIE_NAME', default='procv_consent')
CONSENT_COOKIE_MAX_AGE = 180 * 24 * 60 * 60
CONSENT_COOKIE_SECURE = IS_PRODUCTION
CONSENT_COOKIE_SAMESITE = 'Lax'

# Remote announcement delivery is a runtime, per-surface kill switch. Keep the
# default fail-closed; the frontend rollout flag remains a separate build-time
# compatibility gate. Operators enable surfaces progressively after smoke tests.
ANNOUNCEMENT_REMOTE_ENABLED_SURFACES = tuple(
    surface.strip().lower()
    for surface in config(
        'ANNOUNCEMENT_REMOTE_ENABLED_SURFACES',
        default='',
        cast=Csv(),
    )
    if surface.strip()
)

JOB_VIEW_DEDUP_TTL_SECONDS = config('JOB_VIEW_DEDUP_TTL_SECONDS', default=24 * 60 * 60, cast=int)
JOB_VIEWER_COOKIE_NAME = config('JOB_VIEWER_COOKIE_NAME', default='procv_viewer_id')
JOB_VIEWER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
JOB_VIEWER_COOKIE_SECURE = IS_PRODUCTION
JOB_VIEWER_COOKIE_SAMESITE = 'Lax'

# Job deadline policy is exposed by the employer posting-context API so every
# client uses the same boundaries as the domain service. The default keeps the
# familiar 30-day suggestion while allowing longer hiring processes up to 90 days.
JOB_POSTING_DEFAULT_DEADLINE_DAYS = config(
    'JOB_POSTING_DEFAULT_DEADLINE_DAYS', default=30, cast=int
)
JOB_POSTING_MAX_DEADLINE_DAYS = config('JOB_POSTING_MAX_DEADLINE_DAYS', default=90, cast=int)
JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS = config(
    'JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS', default=90, cast=int
)

EMPLOYER_BADGE_POLICY_MODE = config('EMPLOYER_BADGE_POLICY_MODE', default='shadow').strip().lower()
