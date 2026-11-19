from django.urls import path

from ..views import (
    CandidateJobAlertDetailView,
    CandidateJobAlertListCreateView,
    CandidateJobRecommendationView,
    CvJobRecommendationView,
    HiddenJobCreateView,
    HiddenJobDestroyView,
    InlineJobRecommendationView,
    JobReportCreateView,
    SavedJobDestroyView,
    SavedJobListCreateView,
    SavedJobRecommendationView,
)

urlpatterns = [
    path('alerts/', CandidateJobAlertListCreateView.as_view(), name='candidate-job-alert-list'),
    path(
        'alerts/<str:public_id>/',
        CandidateJobAlertDetailView.as_view(),
        name='candidate-job-alert-detail',
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
    path('saved/', SavedJobListCreateView.as_view(), name='saved-job-list-create'),
    path('saved/<str:public_id>/', SavedJobDestroyView.as_view(), name='saved-job-destroy'),
    path('<str:public_id>/report/', JobReportCreateView.as_view(), name='job-report-create'),
]
