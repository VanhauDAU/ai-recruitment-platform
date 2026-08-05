"""Read models for the administrator company directory."""

from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    OuterRef,
    Prefetch,
    Q,
    Value,
    When,
)

from ..models import (
    Company,
    CompanyIndustry,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentNeed,
)


def _company_annotations():
    return {
        'recruiter_count': Count('recruiters', distinct=True),
        'owner_count': Count(
            'recruiters',
            filter=Q(recruiters__company_role=RecruiterProfile.CompanyRole.OWNER),
            distinct=True,
        ),
        'member_count': Count(
            'recruiters',
            filter=Q(recruiters__company_role=RecruiterProfile.CompanyRole.MEMBER),
            distinct=True,
        ),
        'unsubmitted_recruiter_count': Count(
            'recruiters',
            filter=Q(recruiters__verification_case__isnull=True),
            distinct=True,
        ),
        'draft_recruiter_count': Count(
            'recruiters',
            filter=Q(recruiters__verification_case__status=EmployerVerificationCase.Status.DRAFT),
            distinct=True,
        ),
        'pending_recruiter_count': Count(
            'recruiters',
            filter=Q(
                recruiters__verification_case__status__in=[
                    EmployerVerificationCase.Status.PENDING,
                    EmployerVerificationCase.Status.IN_REVIEW,
                ]
            ),
            distinct=True,
        ),
        'changes_requested_recruiter_count': Count(
            'recruiters',
            filter=Q(
                recruiters__verification_case__status=(
                    EmployerVerificationCase.Status.CHANGES_REQUESTED
                )
            ),
            distinct=True,
        ),
        'approved_recruiter_count': Count(
            'recruiters',
            filter=Q(
                recruiters__verification_case__status=EmployerVerificationCase.Status.APPROVED
            ),
            distinct=True,
        ),
        'rejected_recruiter_count': Count(
            'recruiters',
            filter=Q(
                recruiters__verification_case__status=EmployerVerificationCase.Status.REJECTED
            ),
            distinct=True,
        ),
        'pending_update_count': Count(
            'update_requests',
            filter=Q(update_requests__status=CompanyUpdateRequest.Status.PENDING),
            distinct=True,
        ),
    }


def _base_companies_queryset():
    owners = (
        RecruiterProfile.objects.filter(company_role=RecruiterProfile.CompanyRole.OWNER)
        .select_related('user', 'verification_case')
        .order_by('created_at', 'id')
    )
    return (
        Company.objects.select_related('created_by')
        .prefetch_related(
            Prefetch('recruiters', queryset=owners, to_attr='admin_directory_owners'),
            Prefetch(
                'company_industries',
                queryset=CompanyIndustry.objects.select_related('industry'),
            ),
        )
        .annotate(**_company_annotations())
    )


def admin_companies_queryset(*, params=None):
    params = params or {}
    queryset = _base_companies_queryset()

    query = params.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(public_id__icontains=query)
            | Q(company_name__icontains=query)
            | Q(trade_name__icontains=query)
            | Q(tax_code__icontains=query)
            | Q(email__icontains=query)
        )

    verification_status = params.get('verification_status')
    if verification_status in Company.VerificationStatus.values:
        queryset = queryset.filter(verification_status=verification_status)

    business_type = params.get('business_type')
    if business_type in Company.BusinessType.values:
        queryset = queryset.filter(business_type=business_type)

    member_role = params.get('member_role')
    if member_role in RecruiterProfile.CompanyRole.values:
        queryset = queryset.filter(recruiters__company_role=member_role)

    recruiter_status = params.get('recruiter_verification_status')
    if recruiter_status == 'none':
        queryset = queryset.filter(recruiters__verification_case__isnull=True)
    elif recruiter_status in EmployerVerificationCase.Status.values:
        queryset = queryset.filter(recruiters__verification_case__status=recruiter_status)

    has_owner = params.get('has_owner', '').lower()
    if has_owner == 'true':
        queryset = queryset.filter(owner_count__gt=0)
    elif has_owner == 'false':
        queryset = queryset.filter(owner_count=0)

    industry = params.get('industry', '').strip()
    if industry:
        queryset = queryset.filter(company_industries__industry__slug=industry)

    ordering = params.get('ordering', '-updated_at')
    allowed_ordering = {
        'company_name',
        '-company_name',
        'business_type',
        '-business_type',
        'created_at',
        '-created_at',
        'updated_at',
        '-updated_at',
        'recruiter_count',
        '-recruiter_count',
        'owner_count',
        '-owner_count',
        'pending_update_count',
        '-pending_update_count',
        'approved_recruiter_count',
        '-approved_recruiter_count',
        'verification_status',
        '-verification_status',
    }
    return queryset.distinct().order_by(
        ordering if ordering in allowed_ordering else '-updated_at',
        '-id',
    )


def admin_company_summary():
    queryset = _base_companies_queryset()
    verification = {
        status: queryset.filter(verification_status=status).count()
        for status in Company.VerificationStatus.values
    }
    pending_update_requests = CompanyUpdateRequest.objects.filter(
        status=CompanyUpdateRequest.Status.PENDING
    ).count()
    companies_without_single_owner = queryset.exclude(owner_count=1).count()
    return {
        'total': queryset.count(),
        'verification': verification,
        'pending_update_requests': pending_update_requests,
        'companies_without_single_owner': companies_without_single_owner,
    }


def admin_company_detail_queryset():
    return _base_companies_queryset().prefetch_related('images').order_by('-id')


def admin_company_recruiters_queryset(company, *, params=None):
    params = params or {}
    queryset = (
        RecruiterProfile.objects.filter(company=company)
        .select_related('user', 'verification_case', 'work_location')
        .annotate(
            _has_recruitment_need=Exists(
                RecruitmentNeed.objects.filter(recruiter_id=OuterRef('pk'))
            )
        )
        .annotate(
            initial_onboarding_completed=Case(
                When(
                    registration_completed_at__isnull=False,
                    user__email_verified=True,
                    _has_recruitment_need=True,
                    then=Value(True),
                ),
                default=Value(False),
                output_field=BooleanField(),
            )
        )
        .order_by('created_at', 'id')
    )
    query = params.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(public_id__icontains=query)
            | Q(user__public_id__icontains=query)
            | Q(user__email__icontains=query)
            | Q(user__full_name__icontains=query)
            | Q(position_title__icontains=query)
        )
    role = params.get('role')
    if role in RecruiterProfile.CompanyRole.values:
        queryset = queryset.filter(company_role=role)
    account_status = params.get('account_status')
    if account_status:
        queryset = queryset.filter(user__status=account_status)
    verification_status = params.get('verification_status')
    if verification_status == 'none':
        queryset = queryset.filter(verification_case__isnull=True)
    elif verification_status in EmployerVerificationCase.Status.values:
        queryset = queryset.filter(verification_case__status=verification_status)

    ordering = params.get('ordering', 'created_at')
    allowed_ordering = {
        'created_at',
        '-created_at',
        'company_role',
        '-company_role',
        'position_title',
        '-position_title',
        'initial_onboarding_completed',
        '-initial_onboarding_completed',
        'verification_case__status',
        '-verification_case__status',
        'user__status',
        '-user__status',
        'user__email',
        '-user__email',
        'user__full_name',
        '-user__full_name',
    }
    ordering = {
        'onboarding_completed_at': 'initial_onboarding_completed',
        '-onboarding_completed_at': '-initial_onboarding_completed',
    }.get(ordering, ordering)
    return queryset.order_by(
        ordering if ordering in allowed_ordering else 'created_at',
        'id',
    )
