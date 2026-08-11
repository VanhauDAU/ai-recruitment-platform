"""Public HTTP views grouped by jobs use case."""

from .alerts import CandidateJobAlertDetailView, CandidateJobAlertListCreateView
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
from .moderation import (
    AdminJobDecisionView,
    AdminJobModerationDetailView,
    AdminJobModerationListView,
    AdminJobModerationSummaryView,
    AdminJobReviewView,
)
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
    AdminJobReportReverseView,
    JobReportCreateView,
)

__all__ = [
    'BenefitListView',
    'AdminJobModerationListView',
    'AdminJobModerationDetailView',
    'AdminJobModerationSummaryView',
    'AdminJobDecisionView',
    'AdminJobReportListView',
    'AdminJobReportResolveView',
    'AdminJobReportReverseView',
    'AdminJobReviewView',
    'JobReportCreateView',
    'CandidateJobRecommendationView',
    'CandidateJobAlertDetailView',
    'CandidateJobAlertListCreateView',
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
