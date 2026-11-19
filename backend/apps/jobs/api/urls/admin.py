from django.urls import path

from ..views import (
    AdminJobDecisionView,
    AdminJobModerationDetailView,
    AdminJobModerationListView,
    AdminJobModerationSummaryView,
    AdminJobReportListView,
    AdminJobReportResolveView,
    AdminJobReportReverseView,
)

urlpatterns = [
    path('moderation/', AdminJobModerationListView.as_view(), name='admin-job-moderation-list'),
    path(
        'moderation/summary/',
        AdminJobModerationSummaryView.as_view(),
        name='admin-job-moderation-summary',
    ),
    path(
        'moderation/<str:public_id>/',
        AdminJobModerationDetailView.as_view(),
        name='admin-job-moderation-detail',
    ),
    path(
        'moderation/<str:public_id>/decisions/',
        AdminJobDecisionView.as_view(),
        name='admin-job-decision',
    ),
    path('reports/', AdminJobReportListView.as_view(), name='admin-job-report-list'),
    path(
        'reports/<str:public_id>/resolve/',
        AdminJobReportResolveView.as_view(),
        name='admin-job-report-resolve',
    ),
    path(
        'reports/<str:public_id>/reverse/',
        AdminJobReportReverseView.as_view(),
        name='admin-job-report-reverse',
    ),
]
