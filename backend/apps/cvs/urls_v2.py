from django.urls import path

from .api_v2_views import (
    CvV2DetailView,
    CvV2DraftView,
    CvV2ListCreateView,
    CvV2PublishView,
    CvV2SaveVersionView,
    CvV2VersionDetailView,
    CvV2VersionListView,
)


urlpatterns = [
    path('', CvV2ListCreateView.as_view(), name='cv-v2-list-create'),
    path('<str:public_id>/', CvV2DetailView.as_view(), name='cv-v2-detail'),
    path('<str:public_id>/draft/', CvV2DraftView.as_view(), name='cv-v2-draft'),
    path('<str:public_id>/save-version/', CvV2SaveVersionView.as_view(), name='cv-v2-save-version'),
    path('<str:public_id>/publish/', CvV2PublishView.as_view(), name='cv-v2-publish'),
    path('<str:public_id>/versions/', CvV2VersionListView.as_view(), name='cv-v2-version-list'),
    path('<str:public_id>/versions/<str:version_public_id>/', CvV2VersionDetailView.as_view(), name='cv-v2-version-detail'),
]
