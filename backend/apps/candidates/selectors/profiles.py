"""Read queries for candidate profiles."""

from ..models import CandidateProfile


def candidate_profile_for_user(user):
    """Return the current user's profile, creating the legacy missing row once."""
    profile, _ = CandidateProfile.objects.select_related('user').get_or_create(user=user)
    return profile
