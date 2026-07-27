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


def recruiter_job_posting_entitlement(user):
    """Return the account-level conditions required for the 100-job quota.

    Recruiters who have not reached this entitlement still retain their
    separate introductory quota. The final job-posting service enforces the
    appropriate limit under a transaction.
    """
    recruiter, verification_completed = recruiter_posting_readiness(user)
    if recruiter is None or recruiter.company_id is None:
        return recruiter, {
            'verification_completed': False,
            'admin_approved': False,
            'account_level': 0,
            'verified_job_quota_eligible': False,
        }

    verification_case = EmployerVerificationCase.objects.filter(
        recruiter=recruiter,
        company=recruiter.company,
    ).first()
    admin_approved = (
        verification_case is not None
        and verification_case.status == EmployerVerificationCase.Status.APPROVED
    )
    business_document_approved = False
    if verification_case is not None:
        business_documents = CompanyDocument.objects.filter(
            verification_case=verification_case,
            is_current=True,
            doc_type__in=[
                CompanyDocument.DocType.AUTHORIZATION_LETTER,
                CompanyDocument.DocType.BUSINESS_REGISTRATION,
                CompanyDocument.DocType.IDENTITY_DOCUMENT,
            ],
        )
        business_document_approved = (
            business_documents.exists()
            and not business_documents.exclude(
                status=CompanyDocument.Status.APPROVED,
            ).exists()
        )

    account_level = 0
    if recruiter.user.email_verified:
        account_level = 1
    if account_level == 1 and recruiter.phone_verified_at and business_document_approved:
        account_level = 2
    # The current product model has no report-history record yet. This is kept
    # aligned with the employer portal's Cấp 3 read-model until that workflow
    # is introduced.
    if account_level == 2:
        account_level = 3

    return recruiter, {
        'verification_completed': verification_completed,
        'admin_approved': admin_approved,
        'account_level': account_level,
        'verified_job_quota_eligible': (
            verification_completed and admin_approved and account_level >= 3
        ),
    }


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
