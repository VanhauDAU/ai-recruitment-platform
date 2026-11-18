"""Tham số chung của các outbox gửi email/thông báo qua Celery.

Mỗi outbox (email xác thực, thông báo ứng viên, digest việc làm, thông báo xác
thực NTD) giữ máy trạng thái riêng trên model của nó; phần dùng chung là cách
nhận ra một bản ghi kẹt ở trạng thái "đang gửi" và số lần thử tối đa.
"""

from datetime import timedelta

# Worker chết giữa chừng để lại bản ghi "sending"; quá ngần này thì vòng dispatch
# được phép nhận lại.
STALE_SENDING_AFTER = timedelta(minutes=5)
MAX_DELIVERY_ATTEMPTS = 4


def stale_sending_before(now):
    """Mốc thời gian: bản ghi bắt đầu gửi trước mốc này coi là kẹt."""
    return now - STALE_SENDING_AFTER


def is_sending_fresh(started_at, now):
    """``True`` khi một lần gửi khác vẫn còn trong hạn và không nên chen vào."""
    return started_at is not None and now - started_at < STALE_SENDING_AFTER
