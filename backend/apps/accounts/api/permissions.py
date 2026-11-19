from rest_framework.permissions import BasePermission

from apps.accounts.services.access import is_account_accessible
from apps.accounts.services.exceptions import AdminPermissionDenied


def _accessible(request):
    return bool(
        request.user and request.user.is_authenticated and is_account_accessible(request.user)
    )


def _resolve_permission_key(request, view):
    action = getattr(view, 'action', None)
    if action:
        return 'actions', action
    method = request.method.upper()
    if method in {'HEAD', 'OPTIONS'}:
        method = 'GET'
    return 'methods', method


class IsCandidate(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_candidate


class IsEmployer(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_employer


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_admin_role


def require_admin(user):
    """Chặn service nghiệp vụ quản trị khi actor không phải admin."""

    if not user or not user.is_authenticated or not user.is_admin_role:
        raise AdminPermissionDenied()
    return True


def require_superuser(user):
    """Chặn thao tác chỉ dành cho superuser (ADR-0018: hai cấp quản trị)."""

    require_admin(user)
    if not user.is_superuser:
        raise AdminPermissionDenied()
    return True


class AdminPortalPermission(IsAdmin):
    """Cổng quản trị hai cấp: mọi admin dùng được nghiệp vụ, superuser có thêm
    thao tác nhạy cảm.

    View khai báo ``require_superuser`` là ``True`` hoặc
    ``{'actions': {...}}`` / ``{'methods': {...}}`` để giới hạn theo action.
    """

    def _requires_superuser(self, request, view):
        requirement = getattr(view, 'require_superuser', False)
        if isinstance(requirement, bool):
            return requirement
        if not isinstance(requirement, dict):
            return False
        namespace, key = _resolve_permission_key(request, view)
        return key in set(requirement.get(namespace, ()))

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if self._requires_superuser(request, view):
            require_superuser(request.user)
        return True
