"""Test builders for public company page scenarios."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.jobs.models import Job

from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    EmployerVerificationCase,
    RecruiterProfile,
)


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


def make_limited_admin(actor, *permission_codes):
    """Admin whose only role holds exactly ``permission_codes``."""
    user_model = get_user_model()
    user = user_model.objects.create_user(
        email=f'page-limited-{user_model.objects.count()}@example.com',
        password='Password@123',
        role=user_model.Role.ADMIN,
        status=user_model.Status.ACTIVE,
    )
    department = Department.objects.create(
        code=f'company-page-{Department.objects.count()}',
        name='Kiểm duyệt trang công ty',
    )
    role = AdminRole.objects.create(
        department=department,
        code='staff',
        name='Nhân viên',
        rank=10,
    )
    for code in permission_codes:
        permission, _ = AdminPermission.objects.get_or_create(
            code=code,
            defaults={'module': 'company', 'label': code},
        )
        role.permissions.add(permission)
    assign_membership(user, role, actor=actor)
    return user


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
    values = {
        'posted_by': posted_by,
        'company': company,
        'title': f'Vị trí {Job.objects.count()}',
        'description': 'Mô tả công việc công khai.',
        'status': Job.Status.ACTIVE,
        'published_at': timezone.now(),
        'deadline': timezone.localdate() + timedelta(days=30),
    }
    values.update(overrides)
    return Job.objects.create(**values)


def hold_company(company):
    # Same write path as the service: update() must not move updated_at.
    Company.objects.filter(pk=company.pk).update(content_policy_hold=True)
