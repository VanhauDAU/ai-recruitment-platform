from rest_framework.permissions import BasePermission

from .exceptions import AdminPermissionDenied
from .selectors.admin_access import effective_permission_codes
from .services.access import is_account_accessible


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


def require_admin_permission(user, *codes, match='all'):
    if not user or not user.is_authenticated or not user.is_admin_role or not codes:
        raise AdminPermissionDenied()
    available = effective_permission_codes(user)
    allowed = (
        any(code in available for code in codes)
        if match == 'any'
        else all(code in available for code in codes)
    )
    if not allowed:
        raise AdminPermissionDenied()
    return True


class HasAdminPermission(IsAdmin):
    """Fail-closed permission gate for administrator endpoints."""

    def _required_permissions(self, request, view):
        hook = getattr(view, 'get_required_admin_permissions', None)
        if callable(hook):
            return hook(request)

        required = getattr(view, 'required_admin_permissions', None)
        if not isinstance(required, dict):
            return required

        _, key = _resolve_permission_key(request, view)
        return required.get(key)

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

        required = self._required_permissions(request, view)
        if not required:
            raise AdminPermissionDenied()
        if self._requires_superuser(request, view) and not request.user.is_superuser:
            raise AdminPermissionDenied()
        require_admin_permission(
            request.user,
            *required,
            match=getattr(view, 'permission_match', 'all'),
        )
        return True
