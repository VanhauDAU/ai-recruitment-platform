"""Actor-scoped reads and access policy for private employer documents."""

from django.db.models import Case, IntegerField, Q, Value, When

from ..models import CompanyDocument, RecruiterProfile
from .company_status import has_explicit_company_link


def _owned_document_filter(*, user, recruiter):
    return Q(uploaded_by=user) | Q(recruiter=recruiter) | Q(verification_case__recruiter=recruiter)


def employer_document_metadata_queryset(*, user, recruiter):
    """Return documents whose redacted metadata may be shown to the actor."""
    visible = Q(recruiter=recruiter) | Q(verification_case__recruiter=recruiter)
    if has_explicit_company_link(recruiter):
        visible |= Q(company=recruiter.company, update_request__isnull=False) | Q(
            company=recruiter.company,
            verification_case__isnull=True,
            uploaded_by=user,
        )
        if recruiter.company_role == RecruiterProfile.CompanyRole.OWNER:
            visible |= Q(company=recruiter.company)
    return (
        CompanyDocument.objects.filter(visible)
        .select_related('verification_case')
        .annotate(
            dpa_owner_priority=Case(
                When(
                    doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                    recruiter=recruiter,
                    then=Value(0),
                ),
                When(
                    doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                    then=Value(1),
                ),
                default=Value(0),
                output_field=IntegerField(),
            ),
        )
    )


def employer_document_content_queryset(*, user, recruiter):
    """Return private document binaries the actor may preview or download."""
    allowed = _owned_document_filter(user=user, recruiter=recruiter)
    if (
        has_explicit_company_link(recruiter)
        and recruiter.company_role == RecruiterProfile.CompanyRole.OWNER
    ):
        allowed |= Q(company_id=recruiter.company_id)
    return CompanyDocument.objects.filter(allowed).select_related('verification_case').distinct()


def can_access_employer_document_content(*, document, user, recruiter):
    """Pure per-row access check; callers must preload ``verification_case``."""
    if document.uploaded_by_id == user.id or document.recruiter_id == recruiter.id:
        return True
    verification_case = document._state.fields_cache.get('verification_case')
    if verification_case is not None and verification_case.recruiter_id == recruiter.id:
        return True
    return bool(
        recruiter.company_id is not None
        and recruiter.company_role == RecruiterProfile.CompanyRole.OWNER
        and document.company_id == recruiter.company_id
    )
