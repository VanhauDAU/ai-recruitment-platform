"""Celery application for background jobs."""

import os

from celery import Celery
from django.core.exceptions import ImproperlyConfigured

# Mọi entrypoint (gunicorn, celery, asgi) đi qua package `config` nên kiểm tại
# đây. Không đoán mặc định: thiếu biến này từng làm production âm thầm chạy
# settings development. Chỉ `manage.py` tự chọn development/test cho tiện dev.
if not os.environ.get('DJANGO_SETTINGS_MODULE'):
    raise ImproperlyConfigured(
        'Thiếu DJANGO_SETTINGS_MODULE (config.settings.production | development | test).',
    )

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
