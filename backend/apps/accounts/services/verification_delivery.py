"""Transactional delivery entry point for email verification."""

from . import email_verification


def queue_verification_email(user):
    """Persist the verification email before dispatching it after commit."""
    # Import lazily: task delivery imports account services to render email.
    from ..models import AuthEmailJob
    from ..tasks import queue_auth_email

    email_verification.start_cooldown(user)
    return queue_auth_email(AuthEmailJob.Kind.VERIFICATION, user)
