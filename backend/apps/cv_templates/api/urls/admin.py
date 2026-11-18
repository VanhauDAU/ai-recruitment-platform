from django.urls import path
from rest_framework.routers import SimpleRouter

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

router = SimpleRouter()
router.register('cv-templates', AdminCvTemplateViewSet, basename='admin-cv-template')
router.register('cv-categories', AdminCvCategoryViewSet, basename='admin-cv-category')
router.register('cv-colors', AdminCvColorViewSet, basename='admin-cv-color')
router.register('cv-backgrounds', AdminCvBackgroundViewSet, basename='admin-cv-background')
router.register(
    'cv-sample-contents', AdminCvSampleContentViewSet, basename='admin-cv-sample-content'
)
router.register(
    'cv-sample-generations',
    AdminCvSampleGenerationViewSet,
    basename='admin-cv-sample-generation',
)
router.register('cv-positions', AdminCvPositionViewSet, basename='admin-cv-position')
router.register(
    'cv-position-fields', AdminCvPositionFieldViewSet, basename='admin-cv-position-field'
)

urlpatterns = [
    path('cv-stats/overview/', AdminCvOverviewView.as_view(), name='admin-cv-overview'),
] + router.urls
