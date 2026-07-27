from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.views.admin_verification import (
    AdminCompanyUpdateRequestViewSet,
    AdminEmployerVerificationViewSet,
)

router = DefaultRouter()
router.register(
    'employer-verifications',
    AdminEmployerVerificationViewSet,
    basename='admin-employer-verification',
)
router.register(
    'company-update-requests',
    AdminCompanyUpdateRequestViewSet,
    basename='admin-company-update-request',
)

urlpatterns = [path('', include(router.urls))]
