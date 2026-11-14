"""Model-level evidence query for legal company representation.

The predicate sits below both selectors and services so public read models and
write guards share one definition of who currently represents a company.
"""

from django.db.models import Exists, F, OuterRef, Q

from apps.accounts.models import User

from .membership import RecruiterProfile
from .verification import CompanyDocument, EmployerVerificationCase


def eligible_representatives_queryset():
    """Recruiters whose current legal evidence authorizes their company link."""
    current_approved_documents = CompanyDocument.objects.filter(
        verification_case_id=OuterRef('verification_case'),
        company_id=OuterRef('company_id'),
        is_current=True,
        status=CompanyDocument.Status.APPROVED,
    )
    return (
        RecruiterProfile.objects.filter(
            company_id__isnull=False,
            user__role=User.Role.EMPLOYER,
            user__status=User.Status.ACTIVE,
            user__is_active=True,
            user__is_deleted=False,
            verification_case__status=EmployerVerificationCase.Status.APPROVED,
            verification_case__company_id=F('company_id'),
        )
        .alias(
            _has_business_registration=Exists(
                current_approved_documents.filter(
                    doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
                )
            ),
            _has_authorization=Exists(
                current_approved_documents.filter(
                    doc_type=CompanyDocument.DocType.AUTHORIZATION_LETTER,
                )
            ),
            _has_identity_document=Exists(
                current_approved_documents.filter(
                    doc_type=CompanyDocument.DocType.IDENTITY_DOCUMENT,
                )
            ),
        )
        .filter(
            Q(
                verification_case__verification_method=(
                    EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
                ),
                _has_business_registration=True,
            )
            | Q(
                verification_case__verification_method=(
                    EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID
                ),
                _has_authorization=True,
                _has_identity_document=True,
            )
        )
    )
