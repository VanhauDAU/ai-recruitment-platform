from django.dispatch import receiver

from apps.employers.models import RecruitmentCampaign
from apps.employers.signals import campaign_status_changed

from .services import close_campaign_jobs


@receiver(campaign_status_changed)
def close_jobs_of_ended_campaign(sender, campaign, actor, **kwargs):
    """A completed or cancelled campaign stops recruiting: its jobs close with it."""
    if campaign.status in RecruitmentCampaign.TERMINAL_STATUSES:
        close_campaign_jobs(campaign, user=actor)
