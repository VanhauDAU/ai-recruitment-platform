from celery import shared_task

from ..services import due_post_ids, publish_post, reconcile_social_posts, run_campaign_schedule


@shared_task(name='apps.campaigns.tasks.run_campaign_schedule')
def run_campaign_schedule_task():
    return run_campaign_schedule()


@shared_task(name='apps.campaigns.tasks.dispatch_due_social_posts')
def dispatch_due_social_posts():
    post_ids = due_post_ids()
    for post_id in post_ids:
        publish_social_post.delay(post_id)
    return len(post_ids)


@shared_task(name='apps.campaigns.tasks.publish_social_post', soft_time_limit=45, time_limit=55)
def publish_social_post(post_id):
    return publish_post(post_id)


@shared_task(name='apps.campaigns.tasks.reconcile_social_posts', soft_time_limit=50, time_limit=55)
def reconcile_social_posts_task(campaign_id=None):
    reconcile_social_posts(campaign_id=campaign_id)
