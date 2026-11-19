"""Lỗi nghiệp vụ dùng chung, không phụ thuộc DRF.

Services raise ``DomainError`` khi client cần xử lý theo ``code`` (xung đột
phiên bản, cooldown, quota…). Handler ở ``common.api.exceptions`` dịch nó thành
response; services không import tầng API.
"""

from http import HTTPStatus


class DomainError(Exception):
    """Lỗi nghiệp vụ mà client cần xử lý theo ``code`` (không phải lỗi nhập liệu)."""

    status_code = HTTPStatus.BAD_REQUEST
    code = 'domain_error'

    def payload(self):
        return {'code': self.code, 'detail': str(self)}
