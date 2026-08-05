"""Central account-access policy."""

from rest_framework.exceptions import PermissionDenied

from ..models import User


def is_account_accessible(user):
    """Return whether an existing user may authenticate and use the product."""
    return bool(
        user and user.is_active and not user.is_deleted and user.status == User.Status.ACTIVE
    )


def lock_account_for_write(user):
    """Serialize domain writes with account enforcement and fail closed."""
    locked_user = User.objects.select_for_update().get(pk=user.pk)
    if not is_account_accessible(locked_user):
        raise PermissionDenied(
            'Tài khoản đang bị hạn chế. Không thể thay đổi dữ liệu cho đến khi được mở lại.'
        )
    return locked_user
