"""Public HTTP views grouped by jobs use case."""

from .ai_generation import (
    EmployerJobAiGenerationCancelView,
    EmployerJobAiGenerationCreateView,
    EmployerJobAiGenerationDetailView,
    EmployerJobAiGenerationFeedbackView,
)
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
    HomepageBestJobListView,
    JobDetailView,
    JobImpressionBatchCreateView,
    JobListView,
    JobStatsView,
    JobSuggestView,
    JobViewCreateView,
    SavedJobDestroyView,
    SavedJobListCreateView,
)
from .recommendations import (
    SavedJobRecommendationView,
    SavedJobRemarketingImpressionView,
    SavedJobRemarketingLaneView,
)
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
    'HomepageBestJobListView',
    'EmployerJobCloseView',
    'EmployerJobAiGenerationCancelView',
    'EmployerJobAiGenerationCreateView',
    'EmployerJobAiGenerationDetailView',
    'EmployerJobAiGenerationFeedbackView',
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
    'SavedJobRemarketingLaneView',
    'SavedJobRemarketingImpressionView',
]
