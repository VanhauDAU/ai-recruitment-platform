"""Ảnh nền catalogue: asset dùng chung (không có chủ) lưu trong bảng `cvs.CvAsset`."""

from apps.cvs.models import CvAsset


def admin_backgrounds_queryset():
    return CvAsset.objects.filter(kind=CvAsset.Kind.BACKGROUND, owner__isnull=True).order_by(
        'created_at'
    )


def active_backgrounds_queryset():
    """Ảnh nền đang bật cho trình tạo CV."""
    return admin_backgrounds_queryset().filter(is_active=True)
