from django.urls import path

from ..views import (
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
    EmployerJobResubmitView,
    EmployerJobSubmitView,
)

urlpatterns = [
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
        'mine/<str:public_id>/resubmit/',
        EmployerJobResubmitView.as_view(),
        name='employer-job-resubmit',
    ),
    path(
        'mine/<str:public_id>/duplicate/',
        EmployerJobDuplicateView.as_view(),
        name='employer-job-duplicate',
    ),
]
