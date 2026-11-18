"""Public command API for campaign distribution and lifecycle automation."""

from .channels import (
    add_channel_cost,
    create_channel,
    delete_channel,
    delete_channel_cost,
    update_channel,
)
from .content import ContentQuotaExceeded, generate_channel_content, render_content
from .health import campaign_health
from .launch import execute_launch, launch_campaign, save_launch_selection
from .launch_check import campaign_launch_overview
from .monitoring import run_health_snapshots, send_weekly_reports, snapshot_campaign
from .report_export import build_pdf, build_xlsx
from .schedule import run_campaign_schedule
from .social_connections import (
    complete_page_connection,
    disconnect_page,
    pending_pages,
    select_page,
    start_page_connection,
)
from .social_posts import (
    cancel_post,
    due_post_ids,
    post_message,
    publish_post,
    reconcile_social_posts,
    reschedule_post,
    schedule_post,
)
from .tracking import (
    channel_link,
    landing_url,
    record_click,
    redirect_target,
    resolve_campaign_attribution,
)

__all__ = [
    'build_pdf',
    'build_xlsx',
    'campaign_health',
    'run_health_snapshots',
    'send_weekly_reports',
    'snapshot_campaign',
    'cancel_post',
    'complete_page_connection',
    'disconnect_page',
    'due_post_ids',
    'pending_pages',
    'post_message',
    'publish_post',
    'reconcile_social_posts',
    'reschedule_post',
    'schedule_post',
    'select_page',
    'start_page_connection',
    'ContentQuotaExceeded',
    'add_channel_cost',
    'campaign_launch_overview',
    'channel_link',
    'create_channel',
    'delete_channel',
    'delete_channel_cost',
    'execute_launch',
    'generate_channel_content',
    'landing_url',
    'launch_campaign',
    'record_click',
    'redirect_target',
    'render_content',
    'resolve_campaign_attribution',
    'run_campaign_schedule',
    'save_launch_selection',
    'update_channel',
]
