"""Read queries about a user's sign-in identities and device sessions."""

from ..models import AuthSession, SocialAccount, User

SESSION_HISTORY_LIMIT = 50


def auth_session_history(user):
    """Newest device sessions of one account, revoked or expired ones included."""
    return AuthSession.objects.filter(user=user)[:SESSION_HISTORY_LIMIT]


def linked_oauth_provider(user):
    """Provider dùng để xác thực lại tài khoản chưa có mật khẩu.

    Lấy liên kết mới nhất; cổng đã giới hạn provider hợp lệ nên không cần lọc
    lại ở đây. ``None`` nghĩa là tài khoản không có đường xác thực lại nào.
    """
    return (
        SocialAccount.objects.filter(user=user)
        .exclude(provider=User.Provider.LOCAL)
        .order_by('-updated_at')
        .values_list('provider', flat=True)
        .first()
    )
