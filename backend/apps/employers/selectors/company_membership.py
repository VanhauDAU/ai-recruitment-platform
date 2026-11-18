"""Read models of company join requests."""

from django.db.models import Exists, OuterRef

from ..models import CompanyJoinRequest, RecruiterProfile
from ..models.representation import eligible_owners_queryset


def _has_eligible_owner():
    return Exists(eligible_owners_queryset().filter(company_id=OuterRef('company_id')))


def pending_company_join_request(user):
    """The caller's own request still waiting for an owner, if any."""
    return (
        CompanyJoinRequest.objects.filter(
            recruiter__user=user, status=CompanyJoinRequest.Status.PENDING
        )
        .select_related('company')
        .annotate(has_eligible_owner=_has_eligible_owner())
        .first()
    )


def company_join_requests_for_owner(user):
    """Pending requests to the company the caller owns; empty for members."""
    owner = RecruiterProfile.objects.filter(
        user=user, company_role=RecruiterProfile.CompanyRole.OWNER, company__isnull=False
    ).first()
    if owner is None:
        return CompanyJoinRequest.objects.none()
    return (
        CompanyJoinRequest.objects.filter(
            company_id=owner.company_id, status=CompanyJoinRequest.Status.PENDING
        )
        .select_related('company', 'recruiter__user')
        .annotate(has_eligible_owner=_has_eligible_owner())
        .order_by('created_at', 'id')
    )


def admin_company_join_requests_queryset(params=None):
    """Join requests for administrators; ``awaiting_admin`` keeps those nobody else can decide."""
    params = params or {}
    queryset = (
        CompanyJoinRequest.objects.select_related('company', 'recruiter__user', 'decided_by')
        .annotate(has_eligible_owner=_has_eligible_owner())
        .order_by('created_at', 'id')
    )
    status = params.get('status', CompanyJoinRequest.Status.PENDING)
    if status in CompanyJoinRequest.Status.values:
        queryset = queryset.filter(status=status)
    if params.get('company'):
        queryset = queryset.filter(company__public_id=params['company'])
    if params.get('awaiting_admin') in {'1', 'true'}:
        queryset = queryset.filter(has_eligible_owner=False)
    return queryset


def pending_join_requests_awaiting_admin():
    """Pending requests to companies without an eligible owner (admin queue)."""
    return CompanyJoinRequest.objects.filter(status=CompanyJoinRequest.Status.PENDING).exclude(
        _has_eligible_owner()
    )
