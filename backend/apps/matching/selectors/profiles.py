"""Truy vấn nạp sẵn dữ liệu cần cho bước trích xuất hồ sơ."""

from django.db.models import Prefetch

from apps.cvs.models import UserCv
from apps.jobs.models import Job, JobSkill, publicly_available_job_filter


def jobs_for_profile(statuses=(Job.Status.ACTIVE,)):
    """Tin kèm kỹ năng (và nhóm), yêu cầu ngoại ngữ, địa điểm; không phát sinh N+1.

    `statuses=None` lấy mọi trạng thái (task đang chạy dở khi tin vừa đóng).
    """
    queryset = Job.objects.all() if statuses is None else Job.objects.filter(status__in=statuses)
    return queryset.prefetch_related(
        Prefetch('job_skills', queryset=JobSkill.objects.select_related('skill__group')),
        'language_requirements__language',
        'job_locations__location__parent',
    ).order_by('pk')


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
