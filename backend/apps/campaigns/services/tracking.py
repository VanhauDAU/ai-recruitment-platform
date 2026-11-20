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


COMPANY_SEGMENT = 'cong-ty'


def channel_link(channel, destination=''):
    """Tracked URL of ``channel``; ``destination`` is a job public_id or ``COMPANY_SEGMENT``."""
    path = f'/r/{channel.code}/{destination}' if destination else f'/r/{channel.code}'
    return f'{settings.FRONTEND_URL.rstrip("/")}{path}'


MAX_POST_JOBS = 10
DEFAULT_POST_JOBS = 5


def _newest_first(job):
    return (job.published_at is not None, job.published_at, job.pk)


def post_jobs(channel):
    """Jobs the channel's post advertises: the chosen open ones, else the newest open jobs.

    Reads ``channel.jobs`` through the prefetch of ``campaign_channels_queryset``.
    """
    from apps.jobs.models import Job

    chosen = [job for job in channel.jobs.all() if job.status != Job.Status.CLOSED]
    if chosen:
        return sorted(chosen, key=_newest_first, reverse=True)[:MAX_POST_JOBS]
    jobs = Job.objects.filter(campaign_id=channel.campaign_id).exclude(status=Job.Status.CLOSED)
    return list(jobs.order_by('-published_at', '-pk')[:DEFAULT_POST_JOBS])


def post_link(channel, jobs=None):
    """The post's main link: one job when it advertises only that job, else its target page."""
    if channel.target == CampaignChannel.Target.COMPANY:
        return channel_link(channel, COMPANY_SEGMENT)
    if channel.target == CampaignChannel.Target.JOB:
        jobs = post_jobs(channel) if jobs is None else jobs
        if len(jobs) == 1:
            return channel_link(channel, jobs[0].public_id)
    return channel_link(channel)


def landing_url(campaign):
    return f'{settings.FRONTEND_URL.rstrip("/")}/tuyen-dung/{campaign.slug}'


def _is_live(campaign):
    return (
        campaign.status == RecruitmentCampaign.Status.ACTIVE
        and not campaign.policy_hold
        and campaign.owner.user.is_active
    )


def redirect_target(channel, destination=''):
    """Where a click goes: the job or company page while the campaign runs, else the landing page."""
    campaign = channel.campaign
    ref = sign_ref(channel.code)
    if _is_live(campaign) and destination == COMPANY_SEGMENT and campaign.company:
        return f'/cong-ty/{campaign.company.slug}?ref={ref}'
    if _is_live(campaign) and destination:
        from apps.jobs.models import Job, publicly_available_job_filter

        job = Job.objects.filter(
            publicly_available_job_filter(), campaign=campaign, public_id=destination
        ).first()
        if job:
            return f'/viec-lam/{job.slug}?ref={ref}'
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
