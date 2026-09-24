"""Read queries for candidate profiles."""

from django.db.models import Prefetch

from ..models import (
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidatePreferredSkill,
    CandidateProfile,
)


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
        .prefetch_related(
            Prefetch(
                'desired_specializations',
                queryset=CandidateDesiredSpecialization.objects.select_related('job_category'),
            ),
            'desired_position_others',
            Prefetch(
                'preferred_provinces',
                queryset=CandidatePreferredProvince.objects.select_related('location'),
            ),
            Prefetch(
                'preferred_skills',
                queryset=CandidatePreferredSkill.objects.select_related('skill'),
            ),
            'candidate_profile__consents',
        )
        .get(pk=preference.pk)
    )
