from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.cvs.api.views.v2 import CvV2BackgroundListView

from .api.views.admin import (
    AdminCvBackgroundViewSet,
    AdminCvCategoryViewSet,
    AdminCvColorViewSet,
    AdminCvPositionFieldViewSet,
    AdminCvPositionViewSet,
    AdminCvSampleContentViewSet,
    AdminCvSampleGenerationViewSet,
    AdminCvTemplateViewSet,
)
from .api.views.v2 import (
    CvCategoryCatalogListView,
    CvPositionDetailsView,
    CvPositionOptionListView,
    CvPositionPreviewView,
    CvSampleContentCatalogListView,
    CvTemplateCatalogDetailView,
    CvTemplateCatalogListView,
    CvTemplateRelatedListView,
)

router = DefaultRouter()
router.register('admin/cv-templates', AdminCvTemplateViewSet, basename='admin-cv-template')
router.register('admin/cv-categories', AdminCvCategoryViewSet, basename='admin-cv-category')
router.register('admin/cv-colors', AdminCvColorViewSet, basename='admin-cv-color')
router.register('admin/cv-backgrounds', AdminCvBackgroundViewSet, basename='admin-cv-background')
router.register(
    'admin/cv-sample-contents', AdminCvSampleContentViewSet, basename='admin-cv-sample-content'
)
router.register(
    'admin/cv-sample-generations',
    AdminCvSampleGenerationViewSet,
    basename='admin-cv-sample-generation',
)
router.register('admin/cv-positions', AdminCvPositionViewSet, basename='admin-cv-position')
router.register(
    'admin/cv-position-fields', AdminCvPositionFieldViewSet, basename='admin-cv-position-field'
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
] + router.urls
