"""Luật thuần của tin trên danh sách công khai (ADR-0026, ADR-0030)."""

from django.utils.translation import gettext as _

# Trần hạn nhận hồ sơ và thời gian hiển thị một tin (ngày); admin chỉ chỉnh trong trần.
MAX_LISTING_DAYS = 90

# Ngưỡng nhãn "Sắp hết hạn" (ngày còn lại tới hạn nộp), admin chỉnh trong khoảng này.
CLOSING_SOON_DEFAULT_DAYS = 7
CLOSING_SOON_MAX_DAYS = 30


def job_presentation(job, *, closing_soon_within, today):
    """Nhãn trên thẻ tin, chỉ do hệ thống tính từ dữ liệu thật.

    Không có hạng trả phí hay nhãn gán tay, nên tin nào đạt điều kiện cũng nhận
    nhãn như nhau và mọi thẻ dùng chung một kiểu hiển thị:

    - ``closing_soon``: hạn nộp còn tối đa ``closing_soon_within`` ngày (lịch Việt Nam).
    - ``fast_response``: huy hiệu Sấm Chớp, tính từ mức phản hồi (ADR-0027).
    """
    labels = []
    if job.deadline is not None and 0 <= (job.deadline - today).days <= closing_soon_within:
        labels.append({'code': 'closing_soon', 'text': _('Sắp hết hạn'), 'tone': 'warning'})
    if job.has_flash_badge:
        labels.append({'code': 'fast_response', 'text': _('Phản hồi nhanh'), 'tone': 'success'})
    return {'labels': labels}
