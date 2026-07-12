"""Read queries for candidate-owned CVs."""

from ..models import UserCv


def candidate_cvs_queryset(user):
    return (
        UserCv.objects.filter(user=user, is_deleted=False)
        .select_related('template')
        .prefetch_related('cv_skills__skill')
        .order_by('-is_default', '-updated_at')
    )
