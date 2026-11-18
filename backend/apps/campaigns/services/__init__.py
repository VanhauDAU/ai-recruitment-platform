"""Public command API for campaign distribution and lifecycle automation."""

from .channels import (
    add_channel_cost,
    create_channel,
    delete_channel,
    delete_channel_cost,
    update_channel,
)
from .content import ContentQuotaExceeded, generate_channel_content, render_content
from .launch import execute_launch, launch_campaign, save_launch_selection
from .launch_check import campaign_launch_overview
from .schedule import run_campaign_schedule
from .tracking import (
    channel_link,
    landing_url,
    record_click,
    redirect_target,
    resolve_campaign_attribution,
)

__all__ = [
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
