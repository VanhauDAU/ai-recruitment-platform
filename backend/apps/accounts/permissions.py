from rest_framework.permissions import BasePermission

from .services.access import is_account_accessible


def _accessible(request):
    return bool(
        request.user
        and request.user.is_authenticated
        and is_account_accessible(request.user)
    )


class IsCandidate(BasePermission):
    """Vai ứng viên là vai nền: mọi tài khoản khả dụng không phải admin.

    Cho phép một tài khoản NTD (đa vai) vẫn dùng được các tính năng ứng viên.
    """

    def has_permission(self, request, view):
        return _accessible(request) and not request.user.is_admin_role


class IsEmployer(BasePermission):
    """Có năng lực NTD (đã có `recruiter_profile`), không phụ thuộc `role` gốc."""

    def has_permission(self, request, view):
        return _accessible(request) and request.user.has_employer_capability


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_admin_role
