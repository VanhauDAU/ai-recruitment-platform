"""Read queries that enforce the account-access policy."""

from ..models import SocialAccount, User


def accessible_users_queryset():
    """Users that are allowed to authenticate and use protected APIs."""
    return User.objects.filter(
        is_active=True,
        is_deleted=False,
        status=User.Status.ACTIVE,
    )


def get_accessible_user(user_id):
    return accessible_users_queryset().filter(pk=user_id).first()


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
