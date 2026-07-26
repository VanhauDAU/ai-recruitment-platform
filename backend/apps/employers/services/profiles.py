"""Recruiter profile workflows."""

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db.models import Q

from ..models import CompanyDocument, EmployerVerificationCase, RecruiterProfile


def get_or_create_recruiter(user):
    recruiter, _ = RecruiterProfile.objects.get_or_create(user=user)
    return recruiter


def recruiter_posting_readiness(user):
    """Return the write-safe predicate used before submitting a job for review.

    This intentionally lives in ``services`` because publishing is a write
    workflow. It mirrors the onboarding read model without importing a
    selector, preserving the ``api → services/selectors → models`` boundary.
    """
    recruiter = RecruiterProfile.objects.select_related('company', 'user').filter(user=user).first()
    if recruiter is None or not _has_explicit_company_link(recruiter):
        return recruiter, False
    if getattr(settings, 'REQUIRE_APPROVED_EMPLOYER_VERIFICATION', False):
        return recruiter, EmployerVerificationCase.objects.filter(
            recruiter=recruiter,
            company=recruiter.company,
            status=EmployerVerificationCase.Status.APPROVED,
        ).exists()
    has_business_document = (
        recruiter.company.documents.filter(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        )
        .exclude(status=CompanyDocument.Status.REJECTED)
        .exists()
    )
    candidate_dpa = Q(
        doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        recruiter=recruiter,
    ) | Q(
        doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        company=recruiter.company,
    )
    has_candidate_dpa = (
        CompanyDocument.objects.filter(candidate_dpa)
        .exclude(status=CompanyDocument.Status.REJECTED)
        .exists()
    )
    verified = all(
        [
            recruiter.user.email_verified,
            recruiter.registration_completed_at is not None,
            recruiter.recruitment_needs.exists(),
            recruiter.phone_verified_at is not None,
            has_business_document,
            has_candidate_dpa,
            recruiter.dpa_accepted_at is not None,
        ]
    )
    return recruiter, verified


def ensure_recruiter_candidate_data_access(user):
    """Enforce the rollout gate before exposing candidate personal data."""
    if recruiter_candidate_data_access_allowed(user):
        return
    raise PermissionDenied(
        'Tài khoản cần được xác thực quyền đại diện trước khi truy cập dữ liệu ứng viên.'
    )


def recruiter_candidate_data_access_allowed(user):
    """Return whether personal candidate data may be included in a response."""
    if not getattr(settings, 'REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS', False):
        return True
    recruiter = RecruiterProfile.objects.filter(user=user).first()
    return (
        recruiter is not None
        and EmployerVerificationCase.objects.filter(
            recruiter=recruiter,
            company_id=recruiter.company_id,
            status=EmployerVerificationCase.Status.APPROVED,
        ).exists()
    )


def _has_explicit_company_link(recruiter):
    if recruiter.company_id is None:
        return False
    company = recruiter.company
    return not (
        company.created_by_id == recruiter.user_id
        and recruiter.company_role == recruiter.CompanyRole.OWNER
        and company.tax_code is None
        and company.has_no_logo
        and company.has_no_website
        and not company.company_industries.exists()
    )
