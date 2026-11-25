"""Hạn phiên theo cổng — nguồn duy nhất cho mọi kiểm tra thời hạn phiên.

Giá trị lấy từ ``settings.AUTH_SESSION_POLICIES`` (theo NIST SP 800-63B-4: ứng
viên ~ AAL1, NTD ~ AAL2, admin ~ AAL3). Cổng của một tài khoản chính là ``role``.
"""

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings


@dataclass(frozen=True)
class SessionPolicy:
    access_lifetime: timedelta
    idle_timeout: timedelta | None
    max_age: timedelta

    def is_idle(self, last_seen_at, now):
        return self.idle_timeout is not None and last_seen_at <= now - self.idle_timeout


def policy_for(role):
    raw = settings.AUTH_SESSION_POLICIES[role]
    idle_minutes = raw['idle_minutes']
    return SessionPolicy(
        access_lifetime=timedelta(minutes=raw['access_minutes']),
        idle_timeout=timedelta(minutes=idle_minutes) if idle_minutes > 0 else None,
        max_age=timedelta(hours=raw['max_age_hours']),
    )
