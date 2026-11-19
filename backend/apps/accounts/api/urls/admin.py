from django.urls import include, path
from rest_framework.routers import SimpleRouter

from ..views.admin_accounts import AdminAccountViewSet
from ..views.admin_audit import AdminAuditLogViewSet
from ..views.admin_invitations import AdminInvitationViewSet

router = SimpleRouter()
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
