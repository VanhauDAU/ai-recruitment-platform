from celery import shared_task

from ..services import (
    due_post_ids,
    publish_post,
    reconcile_social_posts,
    refresh_expiring_tokens,
    run_campaign_schedule,
    run_health_snapshots,
    send_weekly_reports,
)


@shared_task(name='apps.campaigns.tasks.run_campaign_schedule')
def run_campaign_schedule_task():
    return run_campaign_schedule()


@shared_task(name='apps.campaigns.tasks.dispatch_due_social_posts')
def dispatch_due_social_posts():
    post_ids = due_post_ids()
    for post_id in post_ids:
        publish_social_post.delay(post_id)
    return len(post_ids)


# A carousel polls one container per image before publishing (Instagram took 40 s
# for three images on 2026-11-20), so publishing gets three minutes.
@shared_task(name='apps.campaigns.tasks.publish_social_post', soft_time_limit=170, time_limit=180)
def publish_social_post(post_id):
    return publish_post(post_id)


@shared_task(name='apps.campaigns.tasks.reconcile_social_posts', soft_time_limit=50, time_limit=55)
def reconcile_social_posts_task(campaign_id=None):
    reconcile_social_posts(campaign_id=campaign_id)


@shared_task(
    name='apps.campaigns.tasks.snapshot_campaign_health', soft_time_limit=50, time_limit=55
)
def snapshot_campaign_health():
    return run_health_snapshots()


@shared_task(
    name='apps.campaigns.tasks.send_campaign_weekly_reports', soft_time_limit=50, time_limit=55
)
def send_campaign_weekly_reports():
    return send_weekly_reports()


@shared_task(name='apps.campaigns.tasks.refresh_social_tokens', soft_time_limit=110, time_limit=120)
def refresh_social_tokens():
    return refresh_expiring_tokens()
