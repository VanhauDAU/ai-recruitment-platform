from django.urls import path

from .api.views import (
    AdminJobModerationListView,
    AdminJobReviewView,
    BenefitListView,
    CvJobRecommendationView,
    EmployerJobCloseView,
    EmployerJobDetailView,
    EmployerJobDuplicateView,
    EmployerJobExtendView,
    EmployerJobListCreateView,
    EmployerJobPostingContextView,
    EmployerJobReopenView,
    EmployerJobSubmitView,
    JobCategoryListView,
    JobDetailView,
    JobImpressionBatchCreateView,
    JobListView,
    JobStatsView,
    JobSuggestView,
    JobViewCreateView,
    LanguageListView,
    SavedJobDestroyView,
    SavedJobListCreateView,
)

urlpatterns = [
    path(
        'admin/moderation/', AdminJobModerationListView.as_view(), name='admin-job-moderation-list'
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
    path('suggest/', JobSuggestView.as_view(), name='job-suggest'),
    path(
        'impressions/',
        JobImpressionBatchCreateView.as_view(),
        name='job-impression-batch-create',
    ),
    path(
        'recommendations/by-cv/<str:cv_public_id>/',
        CvJobRecommendationView.as_view(),
        name='cv-job-recommendations',
    ),
    path('saved/', SavedJobListCreateView.as_view(), name='saved-job-list-create'),
    path('saved/<str:public_id>/', SavedJobDestroyView.as_view(), name='saved-job-destroy'),
    path('mine/', EmployerJobListCreateView.as_view(), name='employer-job-list-create'),
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
    path('<slug:slug>/views/', JobViewCreateView.as_view(), name='job-view-create'),
    path('', JobListView.as_view(), name='job-list'),
    path('<slug:slug>/', JobDetailView.as_view(), name='job-detail'),
]
