"""Read models of company join requests."""

from ..models import CompanyJoinRequest, RecruiterProfile


def pending_company_join_request(user):
    """The caller's own request still waiting for an owner, if any."""
    return (
        CompanyJoinRequest.objects.filter(
            recruiter__user=user, status=CompanyJoinRequest.Status.PENDING
        )
        .select_related('company')
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
        .order_by('created_at', 'id')
    )
