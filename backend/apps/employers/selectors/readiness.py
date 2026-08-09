"""Canonical employer readiness read adapter.

The capability decision table and evidence queryset live at model level so
read selectors and write guards can share them without crossing sibling
layers. This module adapts unannotated presenter rows when necessary.
"""

from apps.accounts.models import User

from ..models import EmployerVerificationCase
from ..models.readiness import (
    DpaStatus,
    build_annotated_employer_readiness,
    current_dpa_status,
    employer_readiness_queryset,
    evaluate_employer_readiness,
    missing_employer_readiness,
)
from .company_status import has_explicit_company_link
from .onboarding import build_employer_onboarding_steps

__all__ = [
    'DpaStatus',
    'build_employer_readiness',
    'current_dpa_status',
    'employer_readiness_queryset',
    'evaluate_employer_readiness',
]


def build_employer_readiness(recruiter, *, onboarding=None, dpa_status=None):
    """Build the canonical readiness DTO from current employer records."""
    if recruiter is None:
        return missing_employer_readiness()
    if onboarding is None and hasattr(recruiter, 'readiness_has_recruitment_need'):
        return build_annotated_employer_readiness(recruiter, dpa_status=dpa_status)
    onboarding = onboarding or build_employer_onboarding_steps(recruiter)
    try:
        verification_case = recruiter.verification_case
        verification_case_status = (
            verification_case.status
            if verification_case.company_id == recruiter.company_id
            else None
        )
    except EmployerVerificationCase.DoesNotExist:
        verification_case_status = None
    return evaluate_employer_readiness(
        account_state=recruiter.user.status,
        account_accessible=(
            recruiter.user.status == User.Status.ACTIVE
            and recruiter.user.is_active
            and not recruiter.user.is_deleted
        ),
        initial_onboarding_complete=onboarding['account_ready'],
        phone_verified=onboarding['phone_verified'],
        company_linked=has_explicit_company_link(recruiter),
        business_document_submitted=onboarding['business_doc_submitted'],
        candidate_dpa_submitted=onboarding['candidate_dpa_submitted'],
        verification_case_status=verification_case_status,
        dpa_status=dpa_status if dpa_status is not None else current_dpa_status(recruiter),
    )
