"""Recruitment-need command workflows."""

from django.utils import timezone

from ..models import RecruitmentNeed


def create_recruitment_need(*, recruiter, validated_data):
    """Record a recruitment need; it counts as completed at once."""
    values = {**validated_data, 'completed_at': timezone.now()}
    need = RecruitmentNeed.objects.create(recruiter=recruiter, **values)
    return need
