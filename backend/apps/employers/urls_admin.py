from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.views.admin_companies import AdminCompanyViewSet
from .api.views.admin_domain_claims import AdminCompanyDomainClaimViewSet
from .api.views.admin_verification import (
    AdminCompanyUpdateRequestViewSet,
    AdminEmployerVerificationViewSet,
)

router = DefaultRouter()
router.register(
    'company-domain-claims',
    AdminCompanyDomainClaimViewSet,
    basename='admin-company-domain-claim',
)
router.register(
    'companies',
    AdminCompanyViewSet,
    basename='admin-company',
)
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
