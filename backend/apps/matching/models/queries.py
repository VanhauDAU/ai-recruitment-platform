"""Truy vấn dùng chung cho selectors, services và task phân tích.

Đặt ở `models/` vì services xếp task `run_analysis` sau commit, mà services và
selectors không được import lẫn nhau (ADR-0022).
"""

from django.db.models import Prefetch

from apps.jobs.models import Job, JobSkill

from .analysis import MatchAnalysis


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


def analysis_for_run(analysis_id):
    return MatchAnalysis.objects.select_related('cv_version__cv').filter(pk=analysis_id).first()
