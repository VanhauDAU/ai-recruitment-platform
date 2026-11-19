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
]
