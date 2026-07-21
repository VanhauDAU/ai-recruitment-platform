"""Read queries for candidate profiles."""

from ..models import CandidateJobPreference, CandidateProfile


def candidate_profile_for_user(user):
    """Return the current user's profile, creating the legacy missing row once."""
    profile, _ = CandidateProfile.objects.only('id', 'user_id', 'gender').get_or_create(user=user)
    return profile


def candidate_job_preference_for_user(user):
    """Return the preference shell plus every normalized selection for a candidate."""
    profile = candidate_profile_for_user(user)
    preference, _ = CandidateJobPreference.objects.get_or_create(candidate_profile=profile)
    return (
        CandidateJobPreference.objects.select_related('candidate_profile')
        .prefetch_related('desired_specializations__job_category', 'preferred_provinces__location')
        .get(pk=preference.pk)
    )
