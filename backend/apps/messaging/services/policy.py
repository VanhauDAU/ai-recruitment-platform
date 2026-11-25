"""Cấu hình ProCV Connect admin chỉnh được (SiteSetting nhóm Tính năng, ADR-0026)."""

from datetime import timedelta

from apps.sitecontent.selectors import get_bool_setting, get_int_setting


def _int(key, default, minimum, maximum):
    return min(max(get_int_setting(key, default), minimum), maximum)


def connect_enabled():
    return get_bool_setting('connect_enabled', True)


def candidate_unanswered_limit():
    """Số tin ứng viên được gửi khi nhà tuyển dụng chưa trả lời lần nào."""
    return _int('connect_candidate_unanswered_limit', 3, 1, 20)


def attachment_max_bytes():
    return _int('connect_attachment_max_mb', 10, 1, 25) * 1024 * 1024


def unread_email_delay():
    """Chờ bao lâu sau tin chưa đọc mới email nhắc; 0 phút = tắt email nhắc."""
    minutes = _int('connect_unread_email_delay_minutes', 30, 0, 24 * 60)
    return timedelta(minutes=minutes) if minutes else None
