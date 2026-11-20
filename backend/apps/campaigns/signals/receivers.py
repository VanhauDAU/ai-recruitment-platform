from django.db import transaction
from django.dispatch import receiver

from apps.campaigns.signals import campaign_status_changed, social_post_due


@receiver(campaign_status_changed)
def reconcile_posts_after_status_change(sender, campaign, **kwargs):
    """Pause, resume or remove social posts right away instead of at the next beat."""
    from apps.campaigns.tasks import reconcile_social_posts_task

    campaign_id = campaign.pk
    transaction.on_commit(lambda: reconcile_social_posts_task.delay(campaign_id))


@receiver(social_post_due)
def publish_due_post_now(sender, post_id, **kwargs):
    """Publish a post that is due on save; the beat stays the fallback."""
    from apps.campaigns.tasks import publish_social_post

    transaction.on_commit(lambda: publish_social_post.delay(post_id))
