"""Public landing page of a campaign: what candidates may see, and in which state."""

from apps.employers.models import RecruitmentCampaign

Status = RecruitmentCampaign.Status
LANDING_STATES = {
    Status.ACTIVE: 'open',
    Status.PAUSED: 'paused',
    Status.SCHEDULED: 'upcoming',
    Status.COMPLETED: 'ended',
    Status.CANCELLED: 'ended',
}


def public_campaign_by_slug(slug):
    """Campaign shown at ``/tuyen-dung/<slug>``, or ``None`` (404).

    Drafts, campaigns without a company, with the page turned off, or owned by
    a locked account are never public.
    """
    return (
        RecruitmentCampaign.objects.select_related('company', 'owner__user')
        .filter(
            slug=slug,
            landing_enabled=True,
            company__isnull=False,
            owner__user__is_active=True,
            status__in=LANDING_STATES,
        )
        .first()
    )


def landing_state(campaign):
    if campaign.policy_hold and campaign.status == Status.ACTIVE:
        return 'paused'
    return LANDING_STATES[campaign.status]
