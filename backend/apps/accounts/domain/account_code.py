"""Mã tài khoản hiển thị (`User.public_id`) cho cả ba cổng.

Chỉ gồm 8 chữ số để người dùng đọc được qua điện thoại cho bộ phận hỗ trợ. Mã
sinh ngẫu nhiên (không tăng dần) nên không lộ số lượng tài khoản và không đoán
được mã của người khác; chữ số đầu khác 0 để mã luôn đủ 8 ký tự.
"""

import secrets

ACCOUNT_CODE_LENGTH = 8
ACCOUNT_CODE_REGEX = rf'^[1-9][0-9]{{{ACCOUNT_CODE_LENGTH - 1}}}$'

_LOWEST = 10 ** (ACCOUNT_CODE_LENGTH - 1)


def random_account_code() -> str:
    return str(_LOWEST + secrets.randbelow(9 * _LOWEST))
