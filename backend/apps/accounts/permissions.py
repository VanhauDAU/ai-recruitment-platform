from rest_framework.permissions import BasePermission

from .services.access import is_account_accessible


def _accessible(request):
    return bool(
        request.user and request.user.is_authenticated and is_account_accessible(request.user)
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


class IsEmployerWithMFA(BasePermission):
    message = 'Bật MFA trước khi truy cập dữ liệu ứng viên hoặc thay đổi công ty.'

    def has_permission(self, request, view):
        return _accessible(request) and request.user.is_employer and request.user.two_factor_enabled


class IsEmployerWithRecentReauthentication(IsEmployerWithMFA):
    message = 'Hãy đăng nhập lại trước khi thao tác với giấy tờ doanh nghiệp.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        from .services import auth_sessions

        sid = request.auth.get(auth_sessions.SID_CLAIM) if request.auth else None
        session = auth_sessions.active_sessions(request.user).filter(id=sid).first()
        return auth_sessions.is_recent_reauthentication(session)
