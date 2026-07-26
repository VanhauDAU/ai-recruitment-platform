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
    CandidateJobRecommendationView,
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
from .recommendations import SavedJobRecommendationView
from .reports import (
    AdminJobReportListView,
    AdminJobReportResolveView,
    JobReportCreateView,
)

__all__ = [
    'BenefitListView',
    'AdminJobModerationListView',
    'AdminJobReportListView',
    'AdminJobReportResolveView',
    'AdminJobReviewView',
    'JobReportCreateView',
    'CandidateJobRecommendationView',
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
    'SavedJobRecommendationView',
]
