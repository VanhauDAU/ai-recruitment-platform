from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api.views.admin_access import (
    AdminDepartmentViewSet,
    AdminMembershipViewSet,
    AdminPermissionViewSet,
    AdminRoleViewSet,
    AdminStaffViewSet,
)

router = DefaultRouter()
router.register('departments', AdminDepartmentViewSet, basename='admin-department')
router.register('roles', AdminRoleViewSet, basename='admin-role')
router.register('permissions', AdminPermissionViewSet, basename='admin-permission')
router.register('memberships', AdminMembershipViewSet, basename='admin-membership')
router.register('staff', AdminStaffViewSet, basename='admin-staff')

urlpatterns = [
    path('', include(router.urls)),
]
