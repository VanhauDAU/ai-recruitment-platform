from django.urls import path

from apps.cvs.api.views.v2 import CvV2BackgroundListView

from ..views.v2 import (
    CvCategoryCatalogListView,
    CvPositionDetailsView,
    CvPositionOptionListView,
    CvPositionPreviewView,
    CvSampleContentCatalogListView,
    CvTemplateCatalogDetailView,
    CvTemplateCatalogListView,
    CvTemplateRelatedListView,
)

urlpatterns = [
    path('cv-templates/', CvTemplateCatalogListView.as_view(), name='cv-template-v2-list'),
    path(
        'cv-templates/<slug:slug>/',
        CvTemplateCatalogDetailView.as_view(),
        name='cv-template-v2-detail',
    ),
    path(
        'cv-templates/<slug:slug>/related/',
        CvTemplateRelatedListView.as_view(),
        name='cv-template-v2-related',
    ),
    path('cv-categories/', CvCategoryCatalogListView.as_view(), name='cv-category-v2-list'),
    path('cv-backgrounds/', CvV2BackgroundListView.as_view(), name='cv-background-v2-list'),
    path(
        'cv-position-options/',
        CvPositionOptionListView.as_view(),
        name='cv-position-option-v2-list',
    ),
    path('cv-position-preview/', CvPositionPreviewView.as_view(), name='cv-position-preview-v2'),
    path('cv-position-details/', CvPositionDetailsView.as_view(), name='cv-position-details-v2'),
    path(
        'cv-sample-contents/',
        CvSampleContentCatalogListView.as_view(),
        name='cv-sample-content-v2-list',
    ),
]
