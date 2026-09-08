"""Public read/query API for the jobs domain."""

from .ai_admin import (
    job_ai_admin_policy_overview,
    job_ai_queue_overview,
    job_ai_usage_overview,
)
from .ai_generation import employer_job_ai_generation_queryset, job_ai_admin_overview
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
from .recommendations import recommend_inline_jobs_for_candidate
from .reports import ADMIN_JOB_REPORT_ORDERING_FIELDS, job_report_queryset
from .saved_recommendations import recommend_jobs_from_saved
from .saved_remarketing import saved_job_remarketing_lane
from .stats import build_job_stats
from .verification_badge import (
    badge_criteria_payload,
    job_badge_criteria,
    recruiter_badge_eligibility,
)

__all__ = [
    'job_ai_admin_policy_overview',
    'job_ai_queue_overview',
    'job_ai_usage_overview',
    'attach_job_candidate_previews',
    'candidate_job_alerts',
    'build_job_list_queryset',
    'build_job_stats',
    'employer_job_detail_queryset',
    'employer_job_ai_generation_queryset',
    'employer_job_list_queryset',
    'badge_criteria_payload',
    'admin_job_detail_queryset',
    'admin_job_management_queryset',
    'admin_job_management_summary',
    'job_badge_criteria',
    'recruiter_badge_eligibility',
    'job_ai_admin_overview',
    'job_moderation_queryset',
    'ADMIN_JOB_REPORT_ORDERING_FIELDS',
    'job_report_queryset',
    'recommend_jobs_from_saved',
    'recommend_inline_jobs_for_candidate',
    'saved_job_remarketing_lane',
]
