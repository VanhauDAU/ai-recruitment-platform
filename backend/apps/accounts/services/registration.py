"""Self-service account registration (candidate and employer portals)."""

from django.db import transaction

from ..models import User
from .verification_delivery import queue_verification_email


@transaction.atomic
def register_account(*, email, password, role, **fields):
    """Create the portal account and queue its first verification email."""
    user = User.objects.create_user(email=email, password=password, role=role, **fields)
    queue_verification_email(user)
    return user
