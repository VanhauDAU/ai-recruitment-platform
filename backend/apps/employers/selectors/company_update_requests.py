"""Read-only queries for staged company-profile changes."""

from django.db.models import Prefetch, Q
from django.db.models.expressions import RawSQL

from ..models import CompanyDocument, CompanyTaxLookupEvidence, CompanyUpdateRequest
from ..models.company_update import REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES

ADMIN_COMPANY_UPDATE_REQUEST_ORDERING_FIELDS = {
    'company__company_name',
    '-company__company_name',
    'requested_by__email',
    '-requested_by__email',
    'change_count',
    '-change_count',
    'is_sensitive',
    '-is_sensitive',
    'updated_at',
    '-updated_at',
}


def company_changes_require_update_request(company):
    """Initial onboarding may change media directly; later edits need a request."""
    return company.recruiter_verification_cases.exists() or company.update_requests.exists()


def requester_editable_company_update_request(*, company, requester, public_id):
    """The requester's own request that still accepts files, or ``None``."""
    return CompanyUpdateRequest.objects.filter(
        public_id=public_id,
        company=company,
        requested_by=requester,
        status__in=REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
    ).first()


def company_update_requests_queryset(*, company, requester=None):
    """A company's request history, newest submission first; ``requester`` narrows it."""
    queryset = (
        CompanyUpdateRequest.objects.filter(company=company)
        .select_related('requested_by', 'current_revision')
        .prefetch_related(
            Prefetch(
                'documents',
                queryset=CompanyDocument.objects.select_related('verification_case'),
            )
        )
    )
    if requester is not None:
        queryset = queryset.filter(requested_by=requester)
    return queryset.order_by('-submitted_at', '-created_at', '-id')


def company_update_request_for_company(*, company, public_id):
    return (
        CompanyUpdateRequest.objects.filter(public_id=public_id, company=company)
        .select_related('requested_by', 'current_revision')
        .first()
    )


def admin_company_update_requests_queryset(*, params=None):
    """Admin review queue filtered by ``status``/``company``/``q`` and an allowed ``ordering``."""
    params = params or {}
    queryset = CompanyUpdateRequest.objects.select_related(
        'company',
        'requested_by',
        'reviewed_by',
        'current_revision',
    ).prefetch_related(
        'documents__uploaded_by',
        'documents__reviewed_by',
        'events__actor',
        'company__company_industries__industry',
        Prefetch(
            'tax_lookup_evidences',
            queryset=CompanyTaxLookupEvidence.objects.order_by('-created_at', '-id'),
        ),
    )
    if params.get('status'):
        queryset = queryset.filter(status=params['status'])
    if params.get('company'):
        queryset = queryset.filter(company__public_id=params['company'])
    query = (params.get('q') or '').strip()
    if query:
        queryset = queryset.filter(
            Q(public_id__icontains=query)
            | Q(company__company_name__icontains=query)
            | Q(company__tax_code__icontains=query)
            | Q(requested_by__email__icontains=query)
        )
    ordering = params.get('ordering', '-updated_at')
    if ordering in {'change_count', '-change_count'}:
        queryset = queryset.annotate(
            change_count=RawSQL(
                '(SELECT COUNT(*) FROM jsonb_object_keys(employers_companyupdaterequest.changes))',
                (),
            )
        )
    return queryset.order_by(
        ordering if ordering in ADMIN_COMPANY_UPDATE_REQUEST_ORDERING_FIELDS else '-updated_at',
        '-id',
    )
