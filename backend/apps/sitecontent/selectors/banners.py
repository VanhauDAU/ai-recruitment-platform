"""Banner reads (public carousel + admin list).

Số tin đang tuyển của công ty gắn ở tầng api: selectors của sitecontent không
được kéo employers.selectors (employers.services đã đọc sitecontent.selectors).
"""

from django.db.models import Q
from django.utils import timezone

from ..models import Banner


def _with_company(queryset):
    return queryset.select_related('company').prefetch_related('company__industries')


def active_banners(placement=None, *, now=None):
    """Banner đang chạy (bật + trong lịch), sắp theo order.

    Slide nhà tuyển dụng chỉ hiện khi công ty còn công khai.
    """
    now = now or timezone.now()
    queryset = Banner.objects.filter(
        Q(starts_at__isnull=True) | Q(starts_at__lte=now),
        Q(ends_at__isnull=True) | Q(ends_at__gt=now),
        is_active=True,
    ).exclude(
        Q(kind=Banner.Kind.COMPANY)
        & (Q(company__isnull=True) | Q(company__content_policy_hold=True))
    )
    if placement:
        queryset = queryset.filter(placement=placement)
    return _with_company(queryset)


def admin_banners(placement=None, *, pk=None):
    """Mọi banner (kể cả tắt/hết hạn) cho trang quản trị; ``pk`` để đọc lại một banner."""
    queryset = Banner.objects.all()
    if placement:
        queryset = queryset.filter(placement=placement)
    if pk is not None:
        queryset = queryset.filter(pk=pk)
    return _with_company(queryset)
