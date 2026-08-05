"""Recruitment-need command workflows."""

from django.db import transaction
from django.utils import timezone

from ..models import RecruiterProfile, RecruitmentNeed
from .verification import reconcile_recruiter_verification


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
    reconcile_recruiter_verification(locked_recruiter, source='recruitment_need_completed')
    return need
