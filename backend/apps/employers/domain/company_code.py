"""Mã công ty hiển thị (`Company.code`), ví dụ C305812.

Tách khỏi `public_id` (khóa API): mã này chỉ để người dùng đọc cho bộ phận hỗ
trợ và để quản trị viên tra cứu.
"""

from functools import partial

from common.db.readable_code import random_readable_code, readable_code_regex

COMPANY_CODE_PREFIX = 'C'
COMPANY_CODE_DIGITS = 6
COMPANY_CODE_LENGTH = len(COMPANY_CODE_PREFIX) + COMPANY_CODE_DIGITS
COMPANY_CODE_REGEX = readable_code_regex(COMPANY_CODE_DIGITS, COMPANY_CODE_PREFIX)

random_company_code = partial(random_readable_code, COMPANY_CODE_DIGITS, COMPANY_CODE_PREFIX)
