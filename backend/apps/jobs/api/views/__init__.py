"""Public HTTP views grouped by jobs use case."""

from .catalogs import BenefitListView, JobCategoryListView, LanguageListView
from .employer import (
    EmployerJobCloseView,
    EmployerJobDetailView,
    EmployerJobDuplicateView,
    EmployerJobExtendView,
    EmployerJobListCreateView,
    EmployerJobPostingContextView,
    EmployerJobReopenView,
    EmployerJobSubmitView,
)
from .moderation import AdminJobModerationListView, AdminJobReviewView
from .public import (
    CvJobRecommendationView,
    JobDetailView,
    JobImpressionBatchCreateView,
    JobListView,
    JobStatsView,
    JobSuggestView,
    JobViewCreateView,
    SavedJobDestroyView,
    SavedJobListCreateView,
)

__all__ = [
    'BenefitListView',
    'AdminJobModerationListView',
    'AdminJobReviewView',
    'CvJobRecommendationView',
    'EmployerJobCloseView',
    'EmployerJobDetailView',
    'EmployerJobDuplicateView',
    'EmployerJobExtendView',
    'EmployerJobListCreateView',
    'EmployerJobPostingContextView',
    'EmployerJobReopenView',
    'EmployerJobSubmitView',
    'JobCategoryListView',
    'JobDetailView',
    'JobImpressionBatchCreateView',
    'JobViewCreateView',
    'JobListView',
    'JobStatsView',
    'JobSuggestView',
    'LanguageListView',
    'SavedJobDestroyView',
    'SavedJobListCreateView',
]
