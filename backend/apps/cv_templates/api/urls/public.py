from django.urls import path

from apps.cv_templates.api.views.catalog import (
    CvBackgroundCatalogListView,
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
    path('cv-templates/', CvTemplateCatalogListView.as_view(), name='cv-template-list'),
    path(
        'cv-templates/<slug:slug>/',
        CvTemplateCatalogDetailView.as_view(),
        name='cv-template-detail',
    ),
    path(
        'cv-templates/<slug:slug>/related/',
        CvTemplateRelatedListView.as_view(),
        name='cv-template-related',
    ),
    path('cv-categories/', CvCategoryCatalogListView.as_view(), name='cv-category-list'),
    path('cv-backgrounds/', CvBackgroundCatalogListView.as_view(), name='cv-background-list'),
    path(
        'cv-position-options/',
        CvPositionOptionListView.as_view(),
        name='cv-position-option-list',
    ),
    path('cv-position-preview/', CvPositionPreviewView.as_view(), name='cv-position-preview'),
    path('cv-position-details/', CvPositionDetailsView.as_view(), name='cv-position-details'),
    path(
        'cv-sample-contents/',
        CvSampleContentCatalogListView.as_view(),
        name='cv-sample-content-list',
    ),
]
