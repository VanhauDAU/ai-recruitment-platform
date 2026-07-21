from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.cvs.api.views.v2 import CvV2BackgroundListView

from .admin_api_views import (
    AdminCvBackgroundViewSet,
    AdminCvCategoryViewSet,
    AdminCvColorViewSet,
    AdminCvContentBlueprintViewSet,
    AdminCvSampleContentViewSet,
    AdminCvTemplateLocalizationViewSet,
    AdminCvTemplateViewSet,
)
from .api_v2_views import (
    CvCategoryCatalogListView,
    CvPositionOptionListView,
    CvPositionPreviewView,
    CvSampleContentCatalogDetailView,
    CvSampleContentCatalogListView,
    CvTemplateCatalogDetailView,
    CvTemplateCatalogListView,
    CvTemplateRelatedListView,
)

router = DefaultRouter()
router.register('admin/cv-templates', AdminCvTemplateViewSet, basename='admin-cv-template')
router.register(
    'admin/cv-template-localizations',
    AdminCvTemplateLocalizationViewSet,
    basename='admin-cv-template-localization',
)
router.register('admin/cv-categories', AdminCvCategoryViewSet, basename='admin-cv-category')
router.register('admin/cv-colors', AdminCvColorViewSet, basename='admin-cv-color')
router.register('admin/cv-backgrounds', AdminCvBackgroundViewSet, basename='admin-cv-background')
router.register(
    'admin/cv-sample-contents', AdminCvSampleContentViewSet, basename='admin-cv-sample-content'
)
router.register(
    'admin/cv-content-blueprints',
    AdminCvContentBlueprintViewSet,
    basename='admin-cv-content-blueprint',
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
    path(
        'cv-sample-contents/',
        CvSampleContentCatalogListView.as_view(),
        name='cv-sample-content-v2-list',
    ),
    path(
        'cv-sample-contents/<str:public_id>/',
        CvSampleContentCatalogDetailView.as_view(),
        name='cv-sample-content-v2-detail',
    ),
] + router.urls
