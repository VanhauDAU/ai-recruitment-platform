"""Exception handler chung của API (``REST_FRAMEWORK['EXCEPTION_HANDLER']``).

View không tự ``try/except`` để đổi kiểu lỗi:

* ``django.core.exceptions.ValidationError`` từ model/service thành 400 — lỗi
  theo field giữ dạng ``{field: [..]}``, lỗi chung thành ``{"detail": [..]}``;
* ``DomainError`` (lỗi nghiệp vụ có mã HTTP riêng, ví dụ xung đột phiên bản)
  trả nguyên ``payload()``. Khác ``APIException``, giá trị không bị ép thành
  chuỗi, nên số và object lồng giữ đúng kiểu.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(Exception):
    """Lỗi nghiệp vụ mà client cần xử lý theo ``code`` (không phải lỗi nhập liệu)."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = 'domain_error'

    def payload(self):
        return {'code': self.code, 'detail': str(self)}


def django_validation_detail(error):
    if hasattr(error, 'error_dict'):
        return error.message_dict
    return {'detail': error.messages}


def api_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response(exc.payload(), status=exc.status_code)
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(django_validation_detail(exc))
    return drf_exception_handler(exc, context)
