"""Truy vấn nạp sẵn dữ liệu cần cho bước trích xuất hồ sơ."""

from apps.cvs.models import UserCv
from apps.jobs.models import publicly_available_job_filter

from ..models import jobs_for_profile


def public_job_for_profile(slug):
    """Tin ứng viên đang xem được (cùng điều kiện với trang chi tiết tin); None nếu không có."""
    return jobs_for_profile().filter(publicly_available_job_filter(), slug=slug).first()


def cvs_for_profile(email_domain):
    """CV của các tài khoản ứng viên thuộc một tên miền email (vd. CV tổng hợp)."""
    return (
        UserCv.objects.filter(user__email__iendswith=f'@{email_domain}')
        .select_related('user', 'latest_version')
        .order_by('user__email', 'pk')
    )


def owner_cv_for_matching(user, public_id):
    """CV của chính người dùng, chưa xóa, chưa bị khóa, đã có phiên bản; None nếu không có."""
    return (
        UserCv.objects.filter(
            user=user,
            public_id=public_id,
            deleted_at__isnull=True,
            moderation_locked_at__isnull=True,
            latest_version__isnull=False,
        )
        .select_related('latest_version')
        .first()
    )


def latest_cv_versions():
    """Phiên bản mới nhất của mọi CV còn dùng được (cho `matching_backfill`)."""
    return (
        UserCv.objects.filter(
            deleted_at__isnull=True, moderation_locked_at__isnull=True, latest_version__isnull=False
        )
        .select_related('latest_version__cv')
        .order_by('pk')
    )
