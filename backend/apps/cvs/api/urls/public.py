from django.urls import path

from ..views import CvAssetContentView, CvSharedLinkPublicView, CvSharedSourceFileView

urlpatterns = [
    path(
        'assets/<str:asset_public_id>/content/',
        CvAssetContentView.as_view(),
        name='cv-asset-content',
    ),
    path('shares/<str:token>/', CvSharedLinkPublicView.as_view(), name='cv-shared-link-public'),
    path(
        'shares/<str:token>/source/',
        CvSharedSourceFileView.as_view(),
        name='cv-shared-source-file',
    ),
]
