from django.urls import include, path
from rest_framework.routers import SimpleRouter

from ..views.admin_catalog import AdminIndustryViewSet
from ..views.admin_companies import AdminCompanyViewSet
from ..views.admin_company_reports import AdminCompanyReportViewSet
from ..views.admin_content_changes import AdminCompanyContentChangeViewSet
from ..views.admin_domain_claims import AdminCompanyDomainClaimViewSet
from ..views.admin_join_requests import AdminCompanyJoinRequestViewSet
from ..views.admin_verification import (
    AdminCompanyUpdateRequestViewSet,
    AdminEmployerVerificationViewSet,
)

router = SimpleRouter()
router.register('industries', AdminIndustryViewSet, basename='admin-industry')
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
    'company-content-changes',
    AdminCompanyContentChangeViewSet,
    basename='admin-company-content-change',
)
router.register(
    'company-join-requests',
    AdminCompanyJoinRequestViewSet,
    basename='admin-company-join-request',
)
router.register(
    'company-reports',
    AdminCompanyReportViewSet,
    basename='admin-company-report',
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
