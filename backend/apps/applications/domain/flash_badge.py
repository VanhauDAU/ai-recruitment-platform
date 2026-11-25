"""Luật Huy hiệu Sấm Chớp (ADR-0027): NTD đưa ra quyết định cho hồ sơ đúng hạn, đều đặn.

Module thuần: nhận giá trị cấu hình và số liệu đã đếm, trả về ngưỡng và từng
tiêu chí. Service (ghi ảnh chụp) và selector (thẻ tiến độ của NTD) cùng dùng nên
hai phía luôn chấm giống nhau.
"""

from datetime import timedelta
from typing import NamedTuple

SETTING_KEYS = (
    'flash_badge_enabled',
    'flash_badge_window_days',
    'flash_badge_response_hours',
    'flash_badge_min_applications',
    'flash_badge_min_response_rate',
    'flash_badge_active_days',
)

# Cảnh báo "sắp mất huy hiệu" khi một hồ sơ chỉ còn chừng này là quá hạn.
AT_RISK_LEAD = timedelta(hours=24)


class FlashBadgePolicy(NamedTuple):
    enabled: bool
    window: timedelta
    response_within: timedelta
    min_applications: int
    min_response_rate: int
    active_within: timedelta

    @property
    def response_hours(self):
        return int(self.response_within.total_seconds() // 3600)


def _clamp(value, default, minimum, maximum):
    if isinstance(value, bool):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return min(max(number, minimum), maximum)


def parse_policy(values):
    """Ngưỡng từ ``{key: value}`` của SiteSetting, kẹp vào khoảng an toàn."""
    enabled = values.get('flash_badge_enabled', True)
    return FlashBadgePolicy(
        enabled=enabled if isinstance(enabled, bool) else True,
        window=timedelta(days=_clamp(values.get('flash_badge_window_days'), 30, 7, 180)),
        response_within=timedelta(
            hours=_clamp(values.get('flash_badge_response_hours'), 72, 4, 14 * 24)
        ),
        min_applications=_clamp(values.get('flash_badge_min_applications'), 5, 1, 100),
        min_response_rate=_clamp(values.get('flash_badge_min_response_rate'), 80, 1, 100),
        active_within=timedelta(days=_clamp(values.get('flash_badge_active_days'), 7, 1, 60)),
    )


def response_rate(matured_count, on_time_count):
    """Phần trăm hồ sơ được quyết định đúng hạn (làm tròn xuống); ``None`` khi chưa có hồ sơ."""
    if not matured_count:
        return None
    return on_time_count * 100 // matured_count


def criteria(policy, *, matured_count, on_time_count, last_decision_at, at):
    """Ba tiêu chí cấp huy hiệu cho một người đăng tin, theo thứ tự hiển thị."""
    rate = response_rate(matured_count, on_time_count)
    return [
        {
            'code': 'enough_applications',
            'met': matured_count >= policy.min_applications,
            'value': matured_count,
            'target': policy.min_applications,
        },
        {
            'code': 'response_rate',
            'met': rate is not None and rate >= policy.min_response_rate,
            'value': rate,
            'target': policy.min_response_rate,
        },
        {
            'code': 'recent_activity',
            'met': last_decision_at is not None and last_decision_at >= at - policy.active_within,
            'value': last_decision_at,
            'target': policy.active_within.days,
        },
    ]


def is_qualified(policy, **stats):
    return policy.enabled and all(item['met'] for item in criteria(policy, **stats))


def lost_reason(policy, **stats):
    """Mã tiêu chí đầu tiên không đạt (để báo NTD vì sao mất huy hiệu)."""
    if not policy.enabled:
        return 'disabled'
    return next((item['code'] for item in criteria(policy, **stats) if not item['met']), '')
