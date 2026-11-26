"""Đường dẫn và URL của cổng nhà tuyển dụng/quản trị.

Hai cổng chạy theo đường dẫn trên domain chính (/tuyendung, /quan-tri) hoặc trên
subdomain riêng; `config/settings/components/integrations.py` suy ra base từ
EMPLOYER_FRONTEND_URL / ADMIN_FRONTEND_URL. Mọi link backend phát ra (thông báo,
email) dựng qua đây, không viết cứng tiền tố.
"""

from django.conf import settings


def employer_marketing_path(path=''):
    """Trang giới thiệu NTD, vd. `/tuyendung/dich-vu` hoặc `/dich-vu` trên subdomain."""
    return f'{settings.EMPLOYER_MARKETING_BASE}{path}' or '/'


def employer_app_path(path=''):
    """Khu làm việc NTD, vd. `/tuyendung/app/tong-quan` hoặc `/app/tong-quan`."""
    return f'{settings.EMPLOYER_APP_BASE}{path}'


def employer_app_url(path=''):
    return f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}{employer_app_path(path)}'


def employer_marketing_url(path=''):
    return f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}{employer_marketing_path(path)}'


def admin_app_path(path=''):
    return f'{settings.ADMIN_APP_BASE}{path}' or '/'
