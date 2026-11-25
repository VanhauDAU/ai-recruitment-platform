"""Public read/query API for the jobs domain."""

from .ai_admin import (
    job_ai_admin_policy_overview,
    job_ai_queue_overview,
    job_ai_usage_overview,
)
from .ai_generation import employer_job_ai_generation_queryset, job_ai_admin_overview
from .alerts import candidate_job_alerts
from .catalog_admin import (
    admin_benefits_queryset,
    admin_job_categories_queryset,
    admin_languages_queryset,
)
from .catalogs import (
    active_benefits_queryset,
    active_job_categories_queryset,
    active_languages_queryset,
)
from .employer import (
    EMPLOYER_JOB_ATTENTION_FILTERS,
    EMPLOYER_JOB_ORDERINGS,
    attach_job_candidate_previews,
    employer_job_application_summary,
    employer_job_detail_queryset,
    employer_job_list_counts,
    employer_job_list_queryset,
    employer_job_status_counts,
    employer_job_visibility_hold,
)
from .listing import (
    active_jobs_queryset,
    build_job_list_queryset,
    public_jobs_queryset,
    publicly_available_job_filter,
)
from .moderation import (
    admin_job_detail_queryset,
    admin_job_management_queryset,
    admin_job_management_summary,
)
from .recommendations import (
    ranking_intent,
    recommend_inline_jobs_for_candidate,
    rule_scores_for_cv,
)
from .reports import ADMIN_JOB_REPORT_ORDERING_FIELDS, job_report_queryset
from .saved import candidate_saved_job_rows, candidate_saved_jobs_queryset
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
    'admin_benefits_queryset',
    'admin_job_categories_queryset',
    'admin_languages_queryset',
    'ADMIN_JOB_REPORT_ORDERING_FIELDS',
    'active_benefits_queryset',
    'active_job_categories_queryset',
    'active_jobs_queryset',
    'active_languages_queryset',
    'admin_job_detail_queryset',
    'admin_job_management_queryset',
    'admin_job_management_summary',
    'attach_job_candidate_previews',
    'badge_criteria_payload',
    'build_job_list_queryset',
    'build_job_stats',
    'candidate_job_alerts',
    'candidate_saved_job_rows',
    'candidate_saved_jobs_queryset',
    'employer_job_ai_generation_queryset',
    'employer_job_application_summary',
    'employer_job_detail_queryset',
    'EMPLOYER_JOB_ATTENTION_FILTERS',
    'EMPLOYER_JOB_ORDERINGS',
    'employer_job_list_counts',
    'employer_job_list_queryset',
    'employer_job_status_counts',
    'employer_job_visibility_hold',
    'job_ai_admin_overview',
    'job_ai_admin_policy_overview',
    'job_ai_queue_overview',
    'job_ai_usage_overview',
    'job_badge_criteria',
    'job_report_queryset',
    'job_similarity_scores',
    'public_jobs_queryset',
    'publicly_available_job_filter',
    'recommend_inline_jobs_for_candidate',
    'recommend_jobs_from_saved',
    'recruiter_badge_eligibility',
    'ranking_intent',
    'rule_scores_for_cv',
    'similar_jobs_for_job',
]
