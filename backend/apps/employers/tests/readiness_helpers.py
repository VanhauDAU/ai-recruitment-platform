"""Test builders for canonical employer workspace/candidate capabilities."""

from django.conf import settings
from django.utils import timezone

from apps.jobs.models import JobCategory

from ..models import (
    Company,
    CompanyDocument,
    EmployerDpaAcceptance,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentNeed,
)


def make_employer_ready(user, *, company=None, candidate_data=False):
    """Create the minimum persisted evidence for a canonical readiness state."""
    user.email_verified = True
    user.status = user.Status.ACTIVE
    user.is_active = True
    user.is_deleted = False
    user.save(
        update_fields=[
            'email_verified',
            'status',
            'is_active',
            'is_deleted',
            'updated_at',
        ]
    )
    company = company or Company.objects.create(
        company_name=f'Readiness Company {user.pk}',
        created_by=user,
    )
    if not company.tax_code:
        company.tax_code = f'99{user.pk:08d}'
        company.save(update_fields=['tax_code', 'updated_at'])
    recruiter, _ = RecruiterProfile.objects.get_or_create(user=user)
    recruiter.company = company
    recruiter.company_role = (
        RecruiterProfile.CompanyRole.OWNER
        if company.created_by_id == user.pk
        else RecruiterProfile.CompanyRole.MEMBER
    )
    recruiter.registration_completed_at = timezone.now()
    recruiter.verified_phone = f'09{user.pk:08d}'
    recruiter.phone_verified_at = timezone.now()
    recruiter.dpa_accepted_at = timezone.now()
    recruiter.dpa_policy_version = settings.EMPLOYER_DPA_POLICY_VERSION
    recruiter.dpa_document_sha256 = settings.EMPLOYER_DPA_DOCUMENT_SHA256
    recruiter.save(
        update_fields=[
            'company',
            'company_role',
            'registration_completed_at',
            'verified_phone',
            'phone_verified_at',
            'dpa_accepted_at',
            'dpa_policy_version',
            'dpa_document_sha256',
            'updated_at',
        ]
    )
    EmployerDpaAcceptance.objects.get_or_create(
        recruiter=recruiter,
        policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
        document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
        defaults={
            'document_url': settings.EMPLOYER_DPA_DOCUMENT_URL,
            'ip_address': '127.0.0.1',
        },
    )
    category, _ = JobCategory.objects.get_or_create(
        name=f'Readiness category {user.pk}',
        defaults={'category_type': JobCategory.CategoryType.SPECIALIZATION},
    )
    if not recruiter.recruitment_needs.exists():
        RecruitmentNeed.objects.create(
            recruiter=recruiter,
            position_category=category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            is_continuous=True,
            headcount=1,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=timezone.now(),
        )
    verification_case, _ = EmployerVerificationCase.objects.get_or_create(
        recruiter=recruiter,
        defaults={'company': company},
    )
    verification_case.company = company
    verification_case.status = (
        EmployerVerificationCase.Status.APPROVED
        if candidate_data
        else EmployerVerificationCase.Status.PENDING
    )
    verification_case.save(update_fields=['company', 'status', 'updated_at'])
    for doc_type in (
        CompanyDocument.DocType.BUSINESS_REGISTRATION,
        CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
    ):
        CompanyDocument.objects.get_or_create(
            verification_case=verification_case,
            doc_type=doc_type,
            defaults={
                'company': company,
                'recruiter': recruiter,
                'uploaded_by': user,
                'file_url': f'employers/tests/{user.pk}/{doc_type}.pdf',
                'file_name': f'{doc_type}.pdf',
                'mime_type': 'application/pdf',
                'file_size': 100,
                'status': CompanyDocument.Status.APPROVED
                if candidate_data
                else CompanyDocument.Status.PENDING,
            },
        )
    return recruiter
