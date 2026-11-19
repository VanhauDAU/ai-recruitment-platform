"""Authenticated password setup/change for the account owner."""

from . import auth_sessions
from .admin_audit import record_admin_self_action
from .tokens import issue_tokens, revoke_refresh_tokens


def change_password(user, session, request, *, password, logout_all_sessions):
    """Set the new password, rotate the session and return a fresh token pair."""
    user.set_password(password)
    user.save(update_fields=['password', 'updated_at'])
    record_admin_self_action(
        user,
        'self_password_change',
        {'logout_all_sessions': logout_all_sessions},
    )

    # Đổi mật khẩu là thao tác nhạy cảm: luôn rotate phiên hiện tại (OWASP —
    # thay session identifier sau thay đổi nhạy cảm) và cấp cặp token mới để
    # thiết bị hiện tại không bị văng giữa luồng (vd onboarding NTD).
    if logout_all_sessions:
        # Đăng xuất mọi thiết bị khác: thu hồi toàn bộ refresh token cũ...
        revoke_refresh_tokens(user)
    else:
        # ...ngược lại thu hồi chính phiên cũ; access token của phiên đó bị
        # middleware chặn ngay nhờ `sid`, không phải chờ JWT hết hạn.
        auth_sessions.revoke_session(session)

    return issue_tokens(user, request, auth_method='password')
