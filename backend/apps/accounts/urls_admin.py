from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.views.account_management import (
    AdminAccountViewSet,
    AdminInvitationViewSet,
    AdminProvisioningScopeViewSet,
)
from .api.views.admin_access import (
    AdminAuditLogViewSet,
    AdminDepartmentViewSet,
    AdminMembershipViewSet,
    AdminPermissionViewSet,
    AdminRoleViewSet,
    AdminStaffViewSet,
)

router = DefaultRouter()
router.register('audit-logs', AdminAuditLogViewSet, basename='admin-audit-log')
router.register('departments', AdminDepartmentViewSet, basename='admin-department')
router.register('roles', AdminRoleViewSet, basename='admin-role')
router.register('permissions', AdminPermissionViewSet, basename='admin-permission')
router.register('memberships', AdminMembershipViewSet, basename='admin-membership')
router.register('staff', AdminStaffViewSet, basename='admin-staff')
router.register('accounts', AdminAccountViewSet, basename='admin-account')
router.register(
    'account-invitations',
    AdminInvitationViewSet,
    basename='admin-account-invitation',
)
router.register(
    'provisioning-scopes',
    AdminProvisioningScopeViewSet,
    basename='admin-provisioning-scope',
)

urlpatterns = [
    path('', include(router.urls)),
]
