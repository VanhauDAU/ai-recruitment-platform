from django.db.models import Count, Min, Q
from django.utils import timezone

from ..models import CompanyDomainClaim


def company_domain_claims_queryset(*, company):
    return (
        CompanyDomainClaim.objects.filter(company=company)
        .select_related('company', 'requested_by', 'reviewer')
        .order_by('-updated_at', '-id')
    )


def admin_domain_claims_queryset(*, params=None):
    params = params or {}
    queryset = CompanyDomainClaim.objects.select_related(
        'company',
        'requested_by',
        'requested_by__recruiter_profile',
        'requested_by__recruiter_profile__verification_case',
        'reviewer',
    )
    status = (params.get('status') or '').strip()
    method = (params.get('method') or '').strip()
    search = (params.get('search') or '').strip()
    if status in CompanyDomainClaim.Status.values:
        queryset = queryset.filter(status=status)
    if method in CompanyDomainClaim.Method.values:
        queryset = queryset.filter(method=method)
    if search:
        queryset = queryset.filter(
            Q(domain__icontains=search)
            | Q(company__company_name__icontains=search)
            | Q(company__public_id__iexact=search)
            | Q(requested_by__email__icontains=search)
        )
    return queryset.order_by('-manual_review_requested_at', '-updated_at', '-id')


def admin_domain_claim_summary():
    """Queue counters for the admin domain-claim dashboard, in one aggregate."""
    pending = CompanyDomainClaim.Status.PENDING
    manual = CompanyDomainClaim.Method.ADMIN_MANUAL
    attention_statuses = [
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.REVOKED,
        CompanyDomainClaim.Status.EXPIRED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    ]
    return CompanyDomainClaim.objects.aggregate(
        total=Count('id'),
        manual_pending=Count(
            'id',
            filter=Q(status=pending, method=manual, manual_review_requested_at__isnull=False),
        ),
        dns_pending=Count(
            'id',
            filter=Q(status=pending, method=CompanyDomainClaim.Method.DNS_TXT),
        ),
        verified=Count('id', filter=Q(status=CompanyDomainClaim.Status.VERIFIED)),
        grace=Count('id', filter=Q(status=CompanyDomainClaim.Status.GRACE)),
        needs_attention=Count('id', filter=Q(status__in=attention_statuses)),
        oldest_manual_pending_at=Min(
            'manual_review_requested_at',
            filter=Q(status=pending, method=manual),
        ),
    )


def domain_claim_allowed_actions(claim):
    actions = []
    if claim.method == CompanyDomainClaim.Method.DNS_TXT and claim.status in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.GRACE,
    }:
        actions.append('verify')
    if claim.status in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.REVOKED,
        CompanyDomainClaim.Status.EXPIRED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    }:
        actions.append('rotate')
    if claim.status in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    } and not (
        claim.method == CompanyDomainClaim.Method.ADMIN_MANUAL
        and claim.manual_review_requested_at is not None
    ):
        actions.append('request_manual_review')
    return actions


def effective_company_domain_claims(*, company_id, domain):
    """Trusted exact-domain claims used by badge/readiness evaluators."""

    now = timezone.now()
    return CompanyDomainClaim.objects.filter(
        company_id=company_id,
        domain=domain,
    ).filter(
        Q(
            status=CompanyDomainClaim.Status.VERIFIED,
        )
        & (Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        | Q(
            status=CompanyDomainClaim.Status.GRACE,
            grace_expires_at__gt=now,
        )
    )
