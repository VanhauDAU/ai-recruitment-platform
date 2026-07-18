from rest_framework.permissions import BasePermission

from .services.access import is_account_accessible


def _accessible(request):
    return bool(
        request.user
        and request.user.is_authenticated
        and is_account_accessible(request.user)
    )


class IsCandidate(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_candidate


class IsEmployer(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_employer


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_admin_role
