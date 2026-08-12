from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.utils import timezone

from ..models import Job

VIETNAM_TIME_ZONE = ZoneInfo('Asia/Ho_Chi_Minh')


def _application_deadline_end(job):
    if job.deadline is None:
        return None
    return datetime.combine(
        job.deadline,
        time.max,
        tzinfo=VIETNAM_TIME_ZONE,
    )


def _active_until(job):
    candidates = [
        value
        for value in (
            job.visibility_ends_at,
            _application_deadline_end(job),
        )
        if value is not None
    ]
    if job.campaign_id and job.campaign.target_date:
        candidates.append(
            datetime.combine(
                job.campaign.target_date,
                time.max,
                tzinfo=VIETNAM_TIME_ZONE,
            )
        )
    return min(candidates) if candidates else None


def job_presentation(job):
    """Resolve one query-free candidate presentation from legacy state.

    Commercial activations will replace the legacy source in a later phase;
    clients consume this stable projection instead of package/tier names.
    """
    sponsored = job.tier != Job.Tier.STANDARD
    if job.tier == Job.Tier.TOP:
        card_tone = 'green'
    elif job.tier == Job.Tier.FEATURED:
        card_tone = 'orange'
    else:
        card_tone = 'neutral'

    labels = []
    if sponsored:
        labels.append(
            {
                'code': 'sponsored',
                'text': 'Tài trợ',
                'tone': 'sponsored',
            }
        )
    if job.is_hot:
        labels.append({'code': 'hot', 'text': 'HOT', 'tone': 'danger'})
    if job.is_urgent:
        labels.append({'code': 'urgent', 'text': 'GẤP', 'tone': 'warning'})
    if job.has_flash_badge:
        labels.append(
            {
                'code': 'fast_response',
                'text': 'Phản hồi nhanh',
                'tone': 'success',
            }
        )

    active_until = _active_until(job)
    return {
        'sponsored': sponsored,
        'card_tone': card_tone,
        'labels': labels,
        'display_reason': '',
        'active_until': timezone.localtime(active_until, VIETNAM_TIME_ZONE)
        if active_until
        else None,
        'placement': 'legacy_priority' if sponsored else 'organic',
    }
