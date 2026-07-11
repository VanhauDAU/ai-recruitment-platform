"""Read queries that enforce the account-access policy."""

from ..models import User


def accessible_users_queryset():
    """Users that are allowed to authenticate and use protected APIs."""
    return User.objects.filter(
        is_active=True,
        is_deleted=False,
        status=User.Status.ACTIVE,
    )


def get_accessible_user(user_id):
    return accessible_users_queryset().filter(pk=user_id).first()
