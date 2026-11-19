from django.urls import path

from ..views.v2 import (
    CvV2AssetContentView,
    CvV2BackgroundListView,
    CvV2SharedLinkPublicView,
    CvV2SharedSourceFileView,
)

urlpatterns = [
    path(
        'assets/<str:asset_public_id>/content/',
        CvV2AssetContentView.as_view(),
        name='cv-v2-asset-content',
    ),
    path('backgrounds/', CvV2BackgroundListView.as_view(), name='cv-v2-background-list'),
    path(
        'shares/<str:token>/', CvV2SharedLinkPublicView.as_view(), name='cv-v2-shared-link-public'
    ),
    path(
        'shares/<str:token>/source/',
        CvV2SharedSourceFileView.as_view(),
        name='cv-v2-shared-source-file',
    ),
]
