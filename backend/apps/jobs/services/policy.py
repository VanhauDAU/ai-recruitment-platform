"""Luật tin tuyển dụng admin chỉnh được (SiteSetting nhóm "Tin tuyển dụng", ADR-0026).

Trần cứng nằm trong mã nguồn (``MAX_LISTING_DAYS``): admin chỉnh trong trần, giá
trị lạ trong DB bị kẹp lại thay vì phá luồng đăng tin.
"""

from apps.sitecontent.selectors import get_int_setting

from ..domain import MAX_LISTING_DAYS
from ..models import Job


def _int(key, default, minimum, maximum):
    return min(max(get_int_setting(key, default), minimum), maximum)


def job_max_deadline_days():
    return _int('job_max_deadline_days', 90, 1, MAX_LISTING_DAYS)


def job_default_deadline_days():
    return _int('job_default_deadline_days', 30, 1, job_max_deadline_days())


def job_max_public_lifetime_days():
    return _int('job_max_public_lifetime_days', 90, 1, MAX_LISTING_DAYS)


def job_renewal_grace_days():
    return _int('job_renewal_grace_days', 30, 0, MAX_LISTING_DAYS)


def job_view_dedup_seconds():
    return _int('job_view_dedup_hours', 24, 1, 7 * 24) * 3600


def auto_reject_default_days():
    """Thời hạn tự từ chối gợi ý cho tin mới; phải là một lựa chọn của ``Job``."""
    allowed = {days for days, _label in Job.AUTO_REJECTION_AFTER_DAY_CHOICES}
    value = get_int_setting('auto_reject_default_days', 21)
    return value if value in allowed else 21
