"""Tracked channel links: aggregate click counting and signed application attribution.

Clicks are counted without cookies and without storing an IP address. A visitor
is deduplicated per day by a hash of a daily random salt, the IP and the user
agent, kept only in Redis until the end of the Vietnam day.
"""

import hashlib
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from redis.exceptions import RedisError

from apps.campaigns.models import RecruitmentCampaign
from common.http.client_ip import client_ip
from common.vietnam_time import vietnam_day_start, vietnam_now, vietnam_today

from ..models import CampaignChannel, CampaignChannelClickDaily

logger = logging.getLogger(__name__)

REF_SALT = 'campaign-ref'
REF_MAX_AGE = timedelta(days=30)
BOT_PATTERN = re.compile(
    r'bot|crawler|spider|facebookexternalhit|facebot|zalo|linkedinbot|twitterbot|slackbot|whatsapp|telegram',
    re.IGNORECASE,
)


def sign_ref(code):
    return signing.TimestampSigner(salt=REF_SALT).sign(code)


def resolve_campaign_attribution(*, job, ref):
    """Channel credited for an application to ``job``, or ``None`` (counts as organic).

    A missing, tampered, expired or foreign reference never blocks applying.
    """
    if not ref or not job.campaign_id:
        return None
    try:
        code = signing.TimestampSigner(salt=REF_SALT).unsign(str(ref)[:200], max_age=REF_MAX_AGE)
    except signing.BadSignature:
        return None
    return CampaignChannel.objects.filter(code=code, campaign_id=job.campaign_id).first()


def channel_link(channel):
    return f'{settings.FRONTEND_URL.rstrip("/")}/r/{channel.code}'


def landing_url(campaign):
    return f'{settings.FRONTEND_URL.rstrip("/")}/tuyen-dung/{campaign.slug}'


def _is_live(campaign):
    return (
        campaign.status == RecruitmentCampaign.Status.ACTIVE
        and not campaign.policy_hold
        and campaign.owner.user.is_active
    )


def redirect_target(channel):
    """Where a click goes: the chosen job while it is public, else the landing page."""
    campaign = channel.campaign
    ref = sign_ref(channel.code)
    if _is_live(campaign) and channel.target == CampaignChannel.Target.JOB and channel.job:
        from apps.jobs.models import Job, publicly_available_job_filter

        if Job.objects.filter(publicly_available_job_filter(), pk=channel.job_id).exists():
            return f'/viec-lam/{channel.job.slug}?ref={ref}'
    return f'/tuyen-dung/{campaign.slug}?ref={ref}'


def _is_first_click_today(request, channel):
    today = vietnam_today()
    seconds_left = int(
        (vietnam_day_start(today + timedelta(days=1)) - vietnam_now()).total_seconds()
    )
    try:
        salt = cache.get_or_set(
            f'camp-click-salt:{today.isoformat()}', secrets.token_hex(16), 172800
        )
        visitor = hashlib.sha256(
            f'{salt}|{client_ip(request)}|{request.headers.get("User-Agent", "")}'.encode()
        ).hexdigest()
        return cache.add(f'camp-click:{channel.pk}:{visitor}', 1, max(seconds_left, 60))
    except RedisError:
        # Redis down: raw clicks still count, uniques do not.
        logger.warning('Redis unavailable for campaign unique-click dedupe.')
        return False


@transaction.atomic
def record_click(request, channel):
    """Count one click on ``channel``; link previews from social crawlers count apart."""
    is_preview = request.method == 'HEAD' or BOT_PATTERN.search(
        request.headers.get('User-Agent', '')
    )
    counters = {}
    if is_preview:
        counters['preview_count'] = F('preview_count') + 1
    else:
        counters['click_count'] = F('click_count') + 1
        if not _is_live(channel.campaign):
            counters['inactive_click_count'] = F('inactive_click_count') + 1
        if _is_first_click_today(request, channel):
            counters['unique_click_count'] = F('unique_click_count') + 1
    today = vietnam_today()
    CampaignChannelClickDaily.objects.get_or_create(channel=channel, date=today)
    CampaignChannelClickDaily.objects.filter(channel=channel, date=today).update(**counters)
