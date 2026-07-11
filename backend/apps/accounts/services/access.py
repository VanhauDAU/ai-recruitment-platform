"""Central account-access policy."""

from ..models import User


def is_account_accessible(user):
    """Return whether an existing user may authenticate and use the product."""
    return bool(
        user
        and user.is_active
        and not user.is_deleted
        and user.status == User.Status.ACTIVE
    )
