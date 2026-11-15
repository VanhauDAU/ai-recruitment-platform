"""Business calendar of the platform.

``TIME_ZONE`` stays UTC for storage, but deadlines, "today" and daily reports
follow the Vietnamese calendar, so every date boundary goes through here.
"""

from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.utils import timezone

VIETNAM_TZ = ZoneInfo('Asia/Ho_Chi_Minh')


def vietnam_now(value=None):
    return timezone.localtime(value or timezone.now(), timezone=VIETNAM_TZ)


def vietnam_today(value=None):
    return vietnam_now(value).date()


def vietnam_day_start(day):
    """Aware datetime of 00:00 on ``day`` in Vietnam, for range filters."""
    return datetime.combine(day, time.min, tzinfo=VIETNAM_TZ)
