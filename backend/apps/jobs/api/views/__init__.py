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
    EmployerJobResubmitView,
    EmployerJobSubmitView,
)
from .engagement import JobImpressionBatchCreateView, JobViewCreateView
from .moderation import (
    AdminJobDecisionView,
    AdminJobModerationDetailView,
    AdminJobModerationListView,
    AdminJobModerationSummaryView,
)
from .public import (
    HomepageBestJobListView,
    HomepageBestJobLocationsView,
    JobDetailView,
    JobListView,
    JobStatsView,
    JobSuggestView,
)
from .recommendations import (
    CandidateJobRecommendationView,
    CvJobRecommendationView,
    HiddenJobCreateView,
    HiddenJobDestroyView,
    InlineJobRecommendationView,
    SavedJobRecommendationView,
)
from .reports import (
    AdminJobReportListView,
    AdminJobReportResolveView,
    AdminJobReportReverseView,
    JobReportCreateView,
)
from .saved import SavedJobDestroyView, SavedJobListCreateView

__all__ = [
    'BenefitListView',
    'AdminJobModerationListView',
    'AdminJobModerationDetailView',
    'AdminJobModerationSummaryView',
    'AdminJobDecisionView',
    'AdminJobReportListView',
    'AdminJobReportResolveView',
    'AdminJobReportReverseView',
    'JobReportCreateView',
    'CandidateJobRecommendationView',
    'CandidateJobAlertDetailView',
    'CandidateJobAlertListCreateView',
    'CvJobRecommendationView',
    'HomepageBestJobListView',
    'HomepageBestJobLocationsView',
    'HiddenJobCreateView',
    'HiddenJobDestroyView',
    'InlineJobRecommendationView',
    'EmployerJobCloseView',
    'EmployerJobAiGenerationCancelView',
    'EmployerJobAiGenerationCreateView',
    'EmployerJobAiGenerationDetailView',
    'EmployerJobAiGenerationFeedbackView',
    'EmployerJobDetailView',
    'EmployerJobDuplicateView',
    'EmployerJobExtendView',
    'EmployerJobResubmitView',
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
