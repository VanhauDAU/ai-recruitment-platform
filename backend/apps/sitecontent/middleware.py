"""Chế độ bảo trì (SiteSetting ``maintenance_mode``, ADR-0026).

Khi bật, API của cổng ứng viên, nhà tuyển dụng và API công khai trả 503; các
trang SEO do server render cũng trả 503 để công cụ tìm kiếm hiểu là gián đoạn
tạm thời. Trang quản trị (``/api/admin/``), đăng nhập/làm mới phiên, cấu hình
công khai (frontend cần nó để hiện màn bảo trì) và health check vẫn chạy.
Tác vụ nền (Celery) không bị ảnh hưởng.
"""

from django.http import HttpResponse, JsonResponse
from django.utils.html import escape
from django.utils.translation import gettext as _

from .selectors import get_bool_setting, get_string_setting

RETRY_AFTER_SECONDS = 600
BLOCKED_API_PREFIXES = ('/api/public/', '/api/candidate/', '/api/employer/', '/api/auth/register/')
OPEN_API_PREFIXES = ('/api/public/site/settings/', '/api/public/privacy/')


def _message():
    return get_string_setting(
        'maintenance_message', _('Hệ thống đang bảo trì, vui lòng quay lại sau.')
    )


def _is_blocked_api(path):
    return path.startswith(BLOCKED_API_PREFIXES) and not path.startswith(OPEN_API_PREFIXES)


def _is_seo_view(view_func):
    return '.seo.' in getattr(view_func, '__module__', '')


class MaintenanceModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _is_blocked_api(request.path) and get_bool_setting('maintenance_mode'):
            response = JsonResponse({'code': 'maintenance', 'detail': _message()}, status=503)
            response['Retry-After'] = str(RETRY_AFTER_SECONDS)
            return response
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        if not _is_seo_view(view_func) or not get_bool_setting('maintenance_mode'):
            return None
        message = escape(_message())
        response = HttpResponse(
            '<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="robots" content="noindex">'
            f'<title>{message}</title></head><body><p>{message}</p></body></html>',
            status=503,
        )
        response['Retry-After'] = str(RETRY_AFTER_SECONDS)
        return response
