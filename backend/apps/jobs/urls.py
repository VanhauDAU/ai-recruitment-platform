from django.urls import path

from .api.views import (
    AdminJobDecisionView,
    AdminJobModerationDetailView,
    AdminJobModerationListView,
    AdminJobModerationSummaryView,
    AdminJobReportListView,
    AdminJobReportResolveView,
    AdminJobReportReverseView,
    AdminJobReviewView,
    BenefitListView,
    CandidateJobAlertDetailView,
    CandidateJobAlertListCreateView,
    CandidateJobRecommendationView,
    CvJobRecommendationView,
    EmployerJobAiGenerationCancelView,
    EmployerJobAiGenerationCreateView,
    EmployerJobAiGenerationDetailView,
    EmployerJobAiGenerationFeedbackView,
    EmployerJobCloseView,
    EmployerJobDetailView,
    EmployerJobDuplicateView,
    EmployerJobExtendView,
    EmployerJobListCreateView,
    EmployerJobPostingContextView,
    EmployerJobReopenView,
    EmployerJobSubmitView,
    HiddenJobCreateView,
    HiddenJobDestroyView,
    HomepageBestJobListView,
    InlineJobRecommendationView,
    JobCategoryListView,
    JobDetailView,
    JobImpressionBatchCreateView,
    JobListView,
    JobReportCreateView,
    JobStatsView,
    JobSuggestView,
    JobViewCreateView,
    LanguageListView,
    SavedJobDestroyView,
    SavedJobListCreateView,
    SavedJobRecommendationView,
    SavedJobRemarketingImpressionView,
    SavedJobRemarketingLaneView,
)

urlpatterns = [
    path('alerts/', CandidateJobAlertListCreateView.as_view(), name='candidate-job-alert-list'),
    path(
        'alerts/<str:public_id>/',
        CandidateJobAlertDetailView.as_view(),
        name='candidate-job-alert-detail',
    ),
    path(
        'admin/moderation/', AdminJobModerationListView.as_view(), name='admin-job-moderation-list'
    ),
    path(
        'admin/moderation/summary/',
        AdminJobModerationSummaryView.as_view(),
        name='admin-job-moderation-summary',
    ),
    path(
        'admin/moderation/<str:public_id>/',
        AdminJobModerationDetailView.as_view(),
        name='admin-job-moderation-detail',
    ),
    path(
        'admin/moderation/<str:public_id>/decisions/',
        AdminJobDecisionView.as_view(),
        name='admin-job-decision',
    ),
    path(
        'admin/moderation/<str:public_id>/review/',
        AdminJobReviewView.as_view(),
        name='admin-job-review',
    ),
    path('categories/', JobCategoryListView.as_view(), name='job-category-list'),
    path('benefits/', BenefitListView.as_view(), name='benefit-list'),
    path('languages/', LanguageListView.as_view(), name='language-list'),
    path('stats/', JobStatsView.as_view(), name='job-stats'),
    path('best/', HomepageBestJobListView.as_view(), name='homepage-best-job-list'),
    path('suggest/', JobSuggestView.as_view(), name='job-suggest'),
    path(
        'impressions/',
        JobImpressionBatchCreateView.as_view(),
        name='job-impression-batch-create',
    ),
    path(
        'recommendations/for-me/',
        CandidateJobRecommendationView.as_view(),
        name='candidate-job-recommendations',
    ),
    path(
        'recommendations/by-cv/<str:cv_public_id>/',
        CvJobRecommendationView.as_view(),
        name='cv-job-recommendations',
    ),
    path(
        'recommendations/inline/',
        InlineJobRecommendationView.as_view(),
        name='inline-job-recommendations',
    ),
    path(
        'recommendations/hidden/',
        HiddenJobCreateView.as_view(),
        name='hidden-job-create',
    ),
    path(
        'recommendations/hidden/<str:job_public_id>/',
        HiddenJobDestroyView.as_view(),
        name='hidden-job-destroy',
    ),
    path(
        'recommendations/by-saved/',
        SavedJobRecommendationView.as_view(),
        name='saved-job-recommendations',
    ),
    path(
        'remarketing/saved/',
        SavedJobRemarketingLaneView.as_view(),
        name='saved-job-remarketing-lane',
    ),
    path(
        'remarketing/saved/impressions/',
        SavedJobRemarketingImpressionView.as_view(),
        name='saved-job-remarketing-impression',
    ),
    path('saved/', SavedJobListCreateView.as_view(), name='saved-job-list-create'),
    path('saved/<str:public_id>/', SavedJobDestroyView.as_view(), name='saved-job-destroy'),
    path('mine/', EmployerJobListCreateView.as_view(), name='employer-job-list-create'),
    path(
        'mine/ai-generations/',
        EmployerJobAiGenerationCreateView.as_view(),
        name='employer-job-ai-generation-create',
    ),
    path(
        'mine/ai-generations/<str:public_id>/',
        EmployerJobAiGenerationDetailView.as_view(),
        name='employer-job-ai-generation-detail',
    ),
    path(
        'mine/ai-generations/<str:public_id>/cancel/',
        EmployerJobAiGenerationCancelView.as_view(),
        name='employer-job-ai-generation-cancel',
    ),
    path(
        'mine/ai-generations/<str:public_id>/feedback/',
        EmployerJobAiGenerationFeedbackView.as_view(),
        name='employer-job-ai-generation-feedback',
    ),
    path(
        'mine/posting-context/',
        EmployerJobPostingContextView.as_view(),
        name='employer-job-posting-context',
    ),
    path('mine/<str:public_id>/', EmployerJobDetailView.as_view(), name='employer-job-detail'),
    path(
        'mine/<str:public_id>/submit/', EmployerJobSubmitView.as_view(), name='employer-job-submit'
    ),
    path('mine/<str:public_id>/close/', EmployerJobCloseView.as_view(), name='employer-job-close'),
    path(
        'mine/<str:public_id>/reopen/', EmployerJobReopenView.as_view(), name='employer-job-reopen'
    ),
    path(
        'mine/<str:public_id>/extend/', EmployerJobExtendView.as_view(), name='employer-job-extend'
    ),
    path(
        'mine/<str:public_id>/duplicate/',
        EmployerJobDuplicateView.as_view(),
        name='employer-job-duplicate',
    ),
    path('admin/reports/', AdminJobReportListView.as_view(), name='admin-job-report-list'),
    path(
        'admin/reports/<str:public_id>/resolve/',
        AdminJobReportResolveView.as_view(),
        name='admin-job-report-resolve',
    ),
    path(
        'admin/reports/<str:public_id>/reverse/',
        AdminJobReportReverseView.as_view(),
        name='admin-job-report-reverse',
    ),
    path('<str:public_id>/report/', JobReportCreateView.as_view(), name='job-report-create'),
    path('<slug:slug>/views/', JobViewCreateView.as_view(), name='job-view-create'),
    path('', JobListView.as_view(), name='job-list'),
    path('<slug:slug>/', JobDetailView.as_view(), name='job-detail'),
]
