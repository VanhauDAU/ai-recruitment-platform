from rest_framework.permissions import BasePermission

from .services.access import is_account_accessible


def _accessible(request):
    return bool(
        request.user
        and request.user.is_authenticated
        and is_account_accessible(request.user)
    )


class IsCandidate(BasePermission):
    """Có năng lực ứng viên (role gốc candidate hoặc đã có `candidate_profile`)."""

    def has_permission(self, request, view):
        return _accessible(request) and request.user.has_candidate_capability


class IsEmployer(BasePermission):
    """Có năng lực NTD (đã có `recruiter_profile`), không phụ thuộc `role` gốc."""

    def has_permission(self, request, view):
        return _accessible(request) and request.user.has_employer_capability


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_admin_role
