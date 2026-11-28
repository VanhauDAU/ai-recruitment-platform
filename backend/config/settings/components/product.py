"""Tham số nghiệp vụ: consent, thông báo đa cổng, lượt xem tin, chính sách tin."""

from decouple import Csv

from config.env import config

from .core import IS_PRODUCTION

# Tăng khi chính sách cookie thêm bên thứ ba (2: Google Analytics 4) để hỏi lại mọi người.
CONSENT_POLICY_VERSION = config('CONSENT_POLICY_VERSION', default=2, cast=int)
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

JOB_VIEWER_COOKIE_NAME = config('JOB_VIEWER_COOKIE_NAME', default='procv_viewer_id')
JOB_VIEWER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
JOB_VIEWER_COOKIE_SECURE = IS_PRODUCTION
JOB_VIEWER_COOKIE_SAMESITE = 'Lax'

# Hạn tin và thời gian khử trùng lượt xem là SiteSetting (nhóm "Tin tuyển dụng",
# ADR-0026); trần 90 ngày nằm ở apps/jobs/services/policy.py.

EMPLOYER_BADGE_POLICY_MODE = config('EMPLOYER_BADGE_POLICY_MODE', default='shadow').strip().lower()
