from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views.admin import (
    AdminCvBackgroundViewSet,
    AdminCvCategoryViewSet,
    AdminCvColorViewSet,
    AdminCvOverviewView,
    AdminCvPositionFieldViewSet,
    AdminCvPositionViewSet,
    AdminCvSampleContentViewSet,
    AdminCvSampleGenerationViewSet,
    AdminCvTemplateViewSet,
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
    path('admin/cv-stats/overview/', AdminCvOverviewView.as_view(), name='admin-cv-overview'),
] + router.urls
