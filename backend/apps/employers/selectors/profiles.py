"""Read-only recruiter profile lookups."""

from ..models import RecruiterProfile


def existing_recruiter_profile(user):
    """The caller's recruiter profile, or ``None``; reads never create one."""
    return RecruiterProfile.objects.filter(user=user).first()
