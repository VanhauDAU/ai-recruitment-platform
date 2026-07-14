"""Read queries for candidate-owned CVs."""

from ..models import CvVersion, UserCv


def candidate_cvs_queryset(user):
    return (
        UserCv.objects.filter(user=user, is_deleted=False)
        .select_related('template')
        .prefetch_related('cv_skills__skill')
        .order_by('-is_default', '-updated_at')
    )


def candidate_cv_by_public_id(user, public_id):
    """Return one CV only when it belongs to the authenticated candidate."""
    return candidate_cvs_queryset(user).select_related(
        'template', 'current_template_version', 'latest_version', 'published_version',
    ).get(public_id=public_id)


def candidate_cv_versions_queryset(user, cv_public_id):
    """Immutable version history scoped through CV ownership in SQL."""
    return CvVersion.objects.filter(
        cv__user=user,
        cv__public_id=cv_public_id,
        cv__is_deleted=False,
    ).select_related('template_version', 'parent_version').order_by('-version_number')
