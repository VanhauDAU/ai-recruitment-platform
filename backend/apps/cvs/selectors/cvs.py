"""Read queries for candidate-owned CVs."""

from ..models import CvDraft, CvExport, CvSharedLink, CvVersion, UserCv


def candidate_cvs_queryset(user):
    return (
        UserCv.objects.filter(user=user, is_deleted=False)
        .select_related(
            'template',
            'position',
            'draft',
            'draft__base_version',
            'current_template_version',
            'latest_version',
            'published_version',
        )
        .prefetch_related('cv_skills__skill')
        .order_by('-is_default', '-updated_at')
    )


def candidate_cv_by_public_id(user, public_id):
    """Return one CV only when it belongs to the authenticated candidate."""
    return candidate_cvs_queryset(user).get(public_id=public_id)


def candidate_cv_versions_queryset(user, cv_public_id):
    """Immutable version history scoped through CV ownership in SQL."""
    return (
        CvVersion.objects.filter(
            cv__user=user,
            cv__public_id=cv_public_id,
            cv__is_deleted=False,
        )
        .exclude(
            version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT,
        )
        .select_related('template_version', 'parent_version')
        .order_by('-version_number')
    )


def cv_draft(cv):
    """Bản nháp đang soạn của CV, hoặc None."""
    return CvDraft.objects.select_related('base_version').filter(cv=cv).first()


def current_draft_lock_version(cv):
    return CvDraft.objects.filter(cv=cv).values_list('lock_version', flat=True).first()


def cv_shared_links_queryset(cv):
    return CvSharedLink.objects.filter(cv=cv).select_related('version').order_by('-created_at')


def cv_exports_queryset(cv):
    return CvExport.objects.filter(cv=cv).select_related('cv', 'version').order_by('-created_at')
