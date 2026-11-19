"""Recruitment-need command workflows."""

from django.db import transaction
from django.utils import timezone

from ..models import RecruiterProfile, RecruitmentNeed


class InitialRecruitmentNeedAlreadyExists(ValueError):
    """The recruiter has already completed the onboarding recruitment need."""


@transaction.atomic
def create_initial_recruitment_need(*, recruiter, validated_data):
    """Create the onboarding need once, serializing concurrent submissions."""
    locked_recruiter = RecruiterProfile.objects.select_for_update().get(pk=recruiter.pk)
    if locked_recruiter.recruitment_needs.exists():
        raise InitialRecruitmentNeedAlreadyExists

    values = dict(validated_data)
    values['completed_at'] = timezone.now()
    need = RecruitmentNeed.objects.create(recruiter=locked_recruiter, **values)
    return need


def create_recruitment_need(*, recruiter, validated_data):
    """Add another need after onboarding; it counts as completed at once."""
    values = {**validated_data, 'completed_at': timezone.now()}
    need = RecruitmentNeed.objects.create(recruiter=recruiter, **values)
    return need
