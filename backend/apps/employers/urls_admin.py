from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.views.admin_verification import AdminEmployerVerificationViewSet

router = DefaultRouter()
router.register(
    'employer-verifications',
    AdminEmployerVerificationViewSet,
    basename='admin-employer-verification',
)

urlpatterns = [path('', include(router.urls))]
