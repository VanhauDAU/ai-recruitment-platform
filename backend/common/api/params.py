"""Đọc tham số query/setting dạng chuỗi theo một quy ước chung.

Trước đây mỗi view/selector tự so ``== 'true'`` hoặc ``in {'1', 'true'}`` nên
cùng một giá trị có nơi hiểu là bật, nơi hiểu là tắt. Mọi nơi đọc cờ bật/tắt hay
số nguyên từ chuỗi dùng hai hàm này.
"""

TRUE_VALUES = frozenset({'1', 'true', 'yes', 'on'})
FALSE_VALUES = frozenset({'0', 'false', 'no', 'off'})


def parse_bool(value, default=None):
    """``True``/``False`` cho giá trị nhận ra được, ``default`` cho thiếu hoặc lạ.

    ``default=None`` giữ được bộ lọc ba trạng thái (không lọc / có / không).
    """
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    return default


def parse_int(value, default=None, *, minimum=None, maximum=None):
    """Số nguyên từ chuỗi, kẹp trong ``[minimum, maximum]``; ``default`` nếu không đọc được."""
    if isinstance(value, bool):
        return default
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        return default
    if minimum is not None:
        number = max(minimum, number)
    if maximum is not None:
        number = min(maximum, number)
    return number
