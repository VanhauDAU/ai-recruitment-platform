"""Mã hiển thị đọc được qua điện thoại: tiền tố chữ (tùy chọn) + chữ số ngẫu nhiên.

Chỉ dùng chữ số sau tiền tố để tránh nhầm O/0, I/1/l khi đọc cho bộ phận hỗ trợ.
Mã ngẫu nhiên (không tăng dần) nên không lộ số lượng bản ghi; chữ số đầu khác 0
để mã luôn đủ độ dài. Ràng buộc unique trong DB vẫn là chốt cuối khi trùng.
"""

import re
import secrets

from django.db.models import Q

CODE_ATTEMPTS = 20
_SEPARATORS = re.compile(r'[\s.#_-]')


def readable_code_regex(digits: int, prefix: str = '') -> str:
    return rf'^{prefix}[1-9][0-9]{{{digits - 1}}}$'


def random_readable_code(digits: int, prefix: str = '') -> str:
    lowest = 10 ** (digits - 1)
    return f'{prefix}{lowest + secrets.randbelow(9 * lowest)}'


def new_unique_code(queryset, field: str, generate) -> str:
    """Sinh mã chưa có trong `queryset`; ngoại lệ khi không gian mã gần cạn."""
    for _ in range(CODE_ATTEMPTS):
        code = generate()
        if not queryset.filter(**{field: code}).exists():
            return code
    raise RuntimeError('Không còn mã trống sau nhiều lần thử.')


def code_search_q(field: str, query: str) -> Q:
    """Tìm theo mã gõ/đọc tự do: bỏ dấu cách, chấm, gạch, '#'; không phân biệt hoa thường.

    Gõ riêng phần số (thiếu tiền tố) hay một đoạn của mã vẫn khớp.
    """
    code = _SEPARATORS.sub('', query)
    return Q(**{f'{field}__icontains': code}) if code else Q(pk__in=[])
