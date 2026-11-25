"""Log ra stdout (một dòng JSON) và báo lỗi lên Sentry khi có ``SENTRY_DSN``."""

from common.sentry import init_sentry
from config.env import config

from .core import ENVIRONMENT

LOG_LEVEL = config('LOG_LEVEL', default='INFO')
LOGGING = {
    'version': 1,
    # Giữ logger sẵn có của Django (django.server khi runserver) và thư viện.
    'disable_existing_loggers': False,
    'formatters': {
        'json': {'()': 'common.log_format.JsonLineFormatter'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'json'},
    },
    'root': {'handlers': ['console'], 'level': LOG_LEVEL},
    'loggers': {
        # Thay cấu hình mặc định của Django (console chỉ khi DEBUG + mail_admins):
        # một handler duy nhất, không in trùng. 'django.server' (runserver) giữ nguyên.
        'django': {'handlers': ['console'], 'level': LOG_LEVEL, 'propagate': False},
        # 4xx là hành vi bình thường của client (Django log ở WARNING); chỉ giữ 5xx.
        'django.request': {'level': 'ERROR'},
    },
}

SENTRY_DSN = config('SENTRY_DSN', default='')
SENTRY_ENVIRONMENT = config('SENTRY_ENVIRONMENT', default='') or ENVIRONMENT
SENTRY_RELEASE = config('SENTRY_RELEASE', default='')
SENTRY_TRACES_SAMPLE_RATE = config('SENTRY_TRACES_SAMPLE_RATE', default=0.05, cast=float)
if SENTRY_DSN:
    init_sentry(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        release=SENTRY_RELEASE,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
    )
