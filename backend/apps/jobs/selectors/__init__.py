"""Public read/query API for the jobs domain."""

from .alerts import candidate_job_alerts
from .employer import (
    attach_job_candidate_previews,
    employer_job_detail_queryset,
    employer_job_list_queryset,
)
from .listing import build_job_list_queryset
from .moderation import (
    admin_job_detail_queryset,
    admin_job_management_queryset,
    admin_job_management_summary,
    job_moderation_queryset,
)
from .reports import ADMIN_JOB_REPORT_ORDERING_FIELDS, job_report_queryset
from .saved_recommendations import recommend_jobs_from_saved
from .stats import build_job_stats
from .verification_badge import badge_criteria_payload, job_badge_criteria

__all__ = [
    'attach_job_candidate_previews',
    'candidate_job_alerts',
    'build_job_list_queryset',
    'build_job_stats',
    'employer_job_detail_queryset',
    'employer_job_list_queryset',
    'badge_criteria_payload',
    'admin_job_detail_queryset',
    'admin_job_management_queryset',
    'admin_job_management_summary',
    'job_badge_criteria',
    'job_moderation_queryset',
    'ADMIN_JOB_REPORT_ORDERING_FIELDS',
    'job_report_queryset',
    'recommend_jobs_from_saved',
]
