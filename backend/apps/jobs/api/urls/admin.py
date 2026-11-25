from django.urls import path
from rest_framework.routers import SimpleRouter

from ..views import (
    AdminBenefitViewSet,
    AdminJobCategoryIconUploadView,
    AdminJobCategoryViewSet,
    AdminJobDecisionView,
    AdminJobModerationDetailView,
    AdminJobModerationListView,
    AdminJobModerationSummaryView,
    AdminJobReportListView,
    AdminJobReportResolveView,
    AdminJobReportReverseView,
    AdminLanguageViewSet,
)

catalog = SimpleRouter()
catalog.register('categories', AdminJobCategoryViewSet, basename='admin-job-category')
catalog.register('benefits', AdminBenefitViewSet, basename='admin-benefit')
catalog.register('languages', AdminLanguageViewSet, basename='admin-language')

urlpatterns = [
    path(
        'categories/icon/',
        AdminJobCategoryIconUploadView.as_view(),
        name='admin-job-category-icon',
    ),
    *catalog.urls,
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
