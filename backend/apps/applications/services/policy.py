"""Luật ứng tuyển admin chỉnh được (SiteSetting nhóm "Ứng tuyển & SLA", ADR-0026).

Mỗi hàm đọc cấu hình lúc gọi và kẹp giá trị vào khoảng an toàn, để một giá trị
lạ trong DB không phá luồng. ``application_rules()`` phát cùng các giá trị này cho
frontend, nên client và server luôn khớp.
"""

from datetime import timedelta
from typing import NamedTuple

from apps.sitecontent.selectors import get_int_setting, get_setting, get_settings_map


def _int(key, default, minimum, maximum):
    return min(max(get_int_setting(key, default), minimum), maximum)


def max_applications_per_job():
    return _int('application_max_per_job', 3, 1, 10)


def reapply_cooldown():
    return timedelta(minutes=_int('application_reapply_cooldown_minutes', 5, 0, 24 * 60))


def auto_rejection_email_grace():
    """Khoảng chờ trước khi báo ứng viên bị tự động từ chối (nhà tuyển dụng còn hoàn tác)."""
    return timedelta(days=_int('auto_reject_email_grace_days', 3, 0, 14))


def auto_rejection_min_notice():
    """Thời gian nhắc trước khi tự từ chối; cũng là thời hạn tối thiểu sau khi hoàn tác."""
    return timedelta(days=_int('auto_reject_min_notice_days', 3, 1, 14))


def candidate_status_notification_delay():
    """Khoảng chờ hoàn tác trước khi ứng viên nhận thông báo đổi trạng thái.

    Ngắn có chủ đích (mặc định 15 giây): đủ để sửa một cú bấm nhầm, không đủ để
    giữ quyết định khỏi ứng viên.
    """
    return timedelta(seconds=_int('candidate_status_notify_delay_seconds', 15, 0, 60))


def system_reminder_days():
    """Các mốc (ngày từ lúc nộp) hệ thống nhắc nhà tuyển dụng; tăng dần, không trùng."""
    value = get_setting('recruiter_reminder_days')
    days = value if isinstance(value, list) else [3, 7]
    return tuple(sorted({day for day in days if isinstance(day, int) and 1 <= day <= 60}))


class CandidateReminderPolicy(NamedTuple):
    after: timedelta
    interval: timedelta
    max_count: int


def _clamp(value, default, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return min(max(number, minimum), maximum)


def candidate_reminder_policy():
    """Luật nút "Nhắc nhà tuyển dụng" trong một lần đọc (danh sách hồ sơ dùng lại cho mọi dòng)."""
    values = get_settings_map(
        (
            'candidate_reminder_after_days',
            'candidate_reminder_interval_days',
            'candidate_reminder_max',
        )
    )
    return CandidateReminderPolicy(
        after=timedelta(days=_clamp(values.get('candidate_reminder_after_days'), 3, 1, 30)),
        interval=timedelta(days=_clamp(values.get('candidate_reminder_interval_days'), 3, 1, 30)),
        max_count=_clamp(values.get('candidate_reminder_max'), 2, 0, 10),
    )


def review_link_max_days():
    return _int('review_link_max_days', 30, 1, 90)
