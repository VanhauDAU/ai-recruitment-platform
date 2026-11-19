from django.db import transaction
from django.dispatch import receiver

from apps.employers.signals import campaign_status_changed


@receiver(campaign_status_changed)
def reconcile_posts_after_status_change(sender, campaign, **kwargs):
    """Pause, resume or remove Facebook posts right away instead of at the next beat."""
    from apps.campaigns.tasks import reconcile_social_posts_task

    campaign_id = campaign.pk
    transaction.on_commit(lambda: reconcile_social_posts_task.delay(campaign_id))
