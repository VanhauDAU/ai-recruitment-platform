from django.urls import path

from ..views import (
    BenefitListView,
    HomepageBestJobListView,
    HomepageBestJobLocationsView,
    JobCategoryListView,
    JobDetailView,
    JobImpressionBatchCreateView,
    JobListView,
    JobStatsView,
    JobSuggestView,
    JobViewCreateView,
    LanguageListView,
    NearbyJobListView,
    NearbyJobMapView,
)

urlpatterns = [
    path('categories/', JobCategoryListView.as_view(), name='job-category-list'),
    path('benefits/', BenefitListView.as_view(), name='benefit-list'),
    path('languages/', LanguageListView.as_view(), name='language-list'),
    path('stats/', JobStatsView.as_view(), name='job-stats'),
    path('best/', HomepageBestJobListView.as_view(), name='homepage-best-job-list'),
    path(
        'best/locations/',
        HomepageBestJobLocationsView.as_view(),
        name='homepage-best-job-locations',
    ),
    path('suggest/', JobSuggestView.as_view(), name='job-suggest'),
    path('nearby/', NearbyJobListView.as_view(), name='job-nearby-list'),
    path('nearby/map/', NearbyJobMapView.as_view(), name='job-nearby-map'),
    path(
        'impressions/',
        JobImpressionBatchCreateView.as_view(),
        name='job-impression-batch-create',
    ),
    path('<slug:slug>/views/', JobViewCreateView.as_view(), name='job-view-create'),
    path('', JobListView.as_view(), name='job-list'),
    path('<slug:slug>/', JobDetailView.as_view(), name='job-detail'),
]
