"""Shared employer test builders: ready recruiters, companies and their public jobs.

Other apps' tests import these to get an employer that passes the canonical
readiness gates without walking through every onboarding endpoint.
"""

import tempfile
from datetime import timedelta
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from pypdf import PdfWriter

from apps.accounts.models import User
from apps.accounts.services import issue_tokens
from apps.jobs.models import Job, JobCategory

from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    EmployerDpaAcceptance,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentNeed,
)

PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)


def pdf_bytes(*, pages=1, password=''):
    """A PDF that passes the employer structure check (pypdf strict)."""
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=200)
    if password:
        writer.encrypt(password)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def docx_bytes():
    output = BytesIO()
    with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', b'<Types/>')
        archive.writestr('word/document.xml', b'<w:document/>')
    return output.getvalue()


PDF_BYTES = pdf_bytes()
DOCX_BYTES = docx_bytes()
TEST_MEDIA_ROOT = tempfile.mkdtemp()
VALID_COMPANY_DESCRIPTION = 'A' * 500


def make_recruiter(email='employer@example.com', phone_verified=True):
    """Employer account with a recruiter profile and, by default, a verified phone."""
    user = User.objects.create_user(
        email=email,
        password='Password@123',
        role=User.Role.EMPLOYER,
    )
    recruiter = RecruiterProfile.objects.create(user=user)
    if phone_verified:
        verified_phone = f'09{abs(hash(email)) % 10**8:08d}'
        user.phone = verified_phone
        user.save(update_fields=['phone', 'updated_at'])
        recruiter.contact_phone = verified_phone
        recruiter.verified_phone = verified_phone
        recruiter.phone_verified_at = timezone.now()
        recruiter.save(update_fields=['contact_phone', 'verified_phone', 'phone_verified_at'])
    return user, recruiter


def authenticate_employer(client, user):
    tokens = issue_tokens(user, auth_method='password')
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])


def company_payload(industry, **overrides):
    payload = {
        'business_type': 'enterprise',
        'tax_code': '0101234567',
        'company_name': 'Acme Corp',
        'has_no_website': True,
        'email': 'contact@acme.vn',
        'phone': '02412345678',
        'address': 'Hà Nội',
        'company_size': '25-99',
        'description': VALID_COMPANY_DESCRIPTION,
        'industries': [industry.id],
        'primary_industry': industry.id,
    }
    payload.update(overrides)
    return payload


def current_dpa_fields():
    """RecruiterProfile fields of an acceptance of the current DPA."""
    return {
        'dpa_accepted_at': timezone.now(),
        'dpa_policy_version': settings.EMPLOYER_DPA_POLICY_VERSION,
        'dpa_document_sha256': settings.EMPLOYER_DPA_DOCUMENT_SHA256,
    }


def accept_current_dpa(recruiter):
    """Record acceptance of the current DPA, which candidate-data access requires."""
    for field, value in current_dpa_fields().items():
        setattr(recruiter, field, value)
    recruiter.save(
        update_fields=['dpa_accepted_at', 'dpa_policy_version', 'dpa_document_sha256', 'updated_at']
    )
    return recruiter


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
    recruiter.contact_phone = recruiter.verified_phone
    recruiter.phone_verified_at = timezone.now()
    recruiter.dpa_accepted_at = timezone.now()
    recruiter.dpa_policy_version = settings.EMPLOYER_DPA_POLICY_VERSION
    recruiter.dpa_document_sha256 = settings.EMPLOYER_DPA_DOCUMENT_SHA256
    recruiter.save(
        update_fields=[
            'company',
            'company_role',
            'registration_completed_at',
            'contact_phone',
            'verified_phone',
            'phone_verified_at',
            'dpa_accepted_at',
            'dpa_policy_version',
            'dpa_document_sha256',
            'updated_at',
        ]
    )
    if user.phone != recruiter.verified_phone:
        user.phone = recruiter.verified_phone
        user.save(update_fields=['phone', 'updated_at'])
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


def make_verified_representative(user, *, company):
    """Ready recruiter whose approved evidence makes them an eligible representative."""
    recruiter = make_employer_ready(user, company=company, candidate_data=True)
    EmployerVerificationCase.objects.filter(recruiter=recruiter).update(
        verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
    )
    return recruiter


def make_employer(email):
    return get_user_model().objects.create_user(
        email=email,
        password='Password@123',
        role='employer',
    )


def make_candidate(email):
    return get_user_model().objects.create_user(
        email=email,
        password='Password@123',
        role='candidate',
    )


def make_company(creator, *, name, industry=None, **overrides):
    company = Company.objects.create(company_name=name, created_by=creator, **overrides)
    if industry is not None:
        CompanyIndustry.objects.create(company=company, industry=industry, is_primary=True)
    return company


def add_recruiter(company, *, approved=True, role=RecruiterProfile.CompanyRole.OWNER):
    """Link a recruiter; ``approved`` adds the evidence of legal representation."""
    user = make_employer(f'page-recruiter-{RecruiterProfile.objects.count()}@example.com')
    recruiter = RecruiterProfile.objects.create(
        user=user,
        company=company,
        company_role=role,
    )
    if approved:
        accept_current_dpa(recruiter)
        verification_case = EmployerVerificationCase.objects.create(
            recruiter=recruiter,
            company=company,
            verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
            status=EmployerVerificationCase.Status.APPROVED,
        )
        CompanyDocument.objects.create(
            company=company,
            recruiter=recruiter,
            uploaded_by=user,
            verification_case=verification_case,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url=f'companies/{company.pk}/business-registration.pdf',
            status=CompanyDocument.Status.APPROVED,
        )
    return user


def publish_job(company, posted_by, **overrides):
    # jobs.tests.factories builds ready employers with this module, so importing
    # it at module level would be circular.
    from apps.jobs.tests.factories import open_visibility_window

    values = {
        'posted_by': posted_by,
        'company': company,
        'title': f'Vị trí {Job.objects.count()}',
        'description': 'Mô tả công việc công khai.',
        'status': Job.Status.ACTIVE,
        **open_visibility_window(),
        'published_at': timezone.now(),
        'deadline': timezone.localdate() + timedelta(days=30),
    }
    values.update(overrides)
    return Job.objects.create(**values)


def hold_company(company):
    # Same write path as the service: update() must not move updated_at.
    Company.objects.filter(pk=company.pk).update(content_policy_hold=True)
