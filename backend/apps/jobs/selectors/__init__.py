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
    employer_job_application_summary,
    employer_job_detail_queryset,
    employer_job_list_queryset,
    employer_job_status_counts,
    employer_job_visibility_hold,
)
from .listing import active_jobs_queryset, build_job_list_queryset, publicly_available_job_filter
from .moderation import (
    admin_job_detail_queryset,
    admin_job_management_queryset,
    admin_job_management_summary,
)
from .recommendations import recommend_inline_jobs_for_candidate
from .reports import ADMIN_JOB_REPORT_ORDERING_FIELDS, job_report_queryset
from .saved_recommendations import (
    job_similarity_scores,
    recommend_jobs_from_saved,
    similar_jobs_for_job,
)
from .stats import build_job_stats
from .verification_badge import (
    badge_criteria_payload,
    job_badge_criteria,
    recruiter_badge_eligibility,
)

__all__ = [
    'active_jobs_queryset',
    'publicly_available_job_filter',
    'job_ai_admin_policy_overview',
    'job_ai_queue_overview',
    'job_ai_usage_overview',
    'attach_job_candidate_previews',
    'candidate_job_alerts',
    'build_job_list_queryset',
    'build_job_stats',
    'employer_job_application_summary',
    'employer_job_detail_queryset',
    'employer_job_ai_generation_queryset',
    'employer_job_list_queryset',
    'employer_job_status_counts',
    'employer_job_visibility_hold',
    'badge_criteria_payload',
    'admin_job_detail_queryset',
    'admin_job_management_queryset',
    'admin_job_management_summary',
    'job_badge_criteria',
    'recruiter_badge_eligibility',
    'job_ai_admin_overview',
    'ADMIN_JOB_REPORT_ORDERING_FIELDS',
    'job_report_queryset',
    'job_similarity_scores',
    'recommend_jobs_from_saved',
    'similar_jobs_for_job',
    'recommend_inline_jobs_for_candidate',
]
