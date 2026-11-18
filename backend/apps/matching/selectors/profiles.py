"""Truy vấn nạp sẵn dữ liệu cần cho bước trích xuất hồ sơ."""

from django.db.models import Prefetch

from apps.cvs.models import UserCv
from apps.jobs.models import Job, JobSkill


def jobs_for_profile(statuses=(Job.Status.ACTIVE,)):
    """Tin kèm kỹ năng (và nhóm), yêu cầu ngoại ngữ, địa điểm; không phát sinh N+1."""
    return (
        Job.objects.filter(status__in=statuses)
        .prefetch_related(
            Prefetch('job_skills', queryset=JobSkill.objects.select_related('skill__group')),
            'language_requirements__language',
            'job_locations__location__parent',
        )
        .order_by('pk')
    )


def cvs_for_profile(email_domain):
    """CV của các tài khoản ứng viên thuộc một tên miền email (vd. CV tổng hợp)."""
    return (
        UserCv.objects.filter(user__email__iendswith=f'@{email_domain}')
        .select_related('user', 'latest_version')
        .order_by('user__email', 'pk')
    )
