"""Public banner reads."""

from ..models import Banner


def active_banners(placement=None):
    """Banner đang bật, sắp theo order; lọc theo vị trí hiển thị nếu có."""
    queryset = Banner.objects.filter(is_active=True)
    if placement:
        queryset = queryset.filter(placement=placement)
    return queryset
