from django.urls import include, path
from rest_framework.routers import DefaultRouter

from ..views.account_management import AdminAccountViewSet, AdminInvitationViewSet
from ..views.admin_audit import AdminAuditLogViewSet

router = DefaultRouter()
router.register('audit-logs', AdminAuditLogViewSet, basename='admin-audit-log')
router.register('accounts', AdminAccountViewSet, basename='admin-account')
router.register(
    'account-invitations',
    AdminInvitationViewSet,
    basename='admin-account-invitation',
)

urlpatterns = [
    path('', include(router.urls)),
]
