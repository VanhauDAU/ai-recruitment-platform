"""Local development settings; this is the default Django entry point."""

from django.core.exceptions import ImproperlyConfigured

from .base import *

if IS_PRODUCTION:
    raise ImproperlyConfigured(
        'ENVIRONMENT=production phải dùng DJANGO_SETTINGS_MODULE=config.settings.production.',
    )

# Vite giữ nguyên Host khi proxy /api và /media để URL tuyệt đối Django tạo ra
# quay lại đúng origin đang mở trên trình duyệt (kể cả IP LAN thay đổi). Chỉ
# development cho phép host động; production vẫn dùng allowlist bắt buộc riêng.
ALLOWED_HOSTS = ['*']
