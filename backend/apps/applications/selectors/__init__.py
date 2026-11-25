"""Read models for the applications domain."""

from .applications import (
    admin_job_applications_queryset,
    candidate_applications_queryset,
    employer_application_queryset,
    employer_applications_queryset,
    previous_submissions_queryset,
    recruiter_application_history_queryset,
    recruiter_application_snapshot_queryset,
    recruiter_candidate_blocks_queryset,
    recruiter_is_company_owner,
    recruiter_review_links_queryset,
    recruiter_reviews_queryset,
)
from .flash_badge import flash_badge_stats_for_job, recruiter_flash_badge_state
from .talent_pool import (
    candidate_talent_pool_queryset,
    recruiter_talent_pool_jobs_queryset,
    recruiter_talent_pool_queryset,
    talent_suggestions_for_job,
)

__all__ = [
    'flash_badge_stats_for_job',
    'recruiter_flash_badge_state',
    'previous_submissions_queryset',
    'candidate_talent_pool_queryset',
    'recruiter_talent_pool_jobs_queryset',
    'recruiter_talent_pool_queryset',
    'talent_suggestions_for_job',
    'admin_job_applications_queryset',
    'candidate_applications_queryset',
    'employer_application_queryset',
    'employer_applications_queryset',
    'recruiter_application_history_queryset',
    'recruiter_application_snapshot_queryset',
    'recruiter_candidate_blocks_queryset',
    'recruiter_is_company_owner',
    'recruiter_review_links_queryset',
    'recruiter_reviews_queryset',
]
