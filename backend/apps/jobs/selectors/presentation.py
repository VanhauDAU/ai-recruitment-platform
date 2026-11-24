from datetime import datetime, time

from django.utils import timezone
from django.utils.translation import gettext as _

from common.vietnam_time import VIETNAM_TZ

from ..models import Job

VIETNAM_TIME_ZONE = VIETNAM_TZ


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
    """Resolve the card projection from labels and the visibility window.

    ``has_flash_badge`` (Sấm Chớp) is computed from recruiter responsiveness (ADR-0027).
    """
    sponsored = job.tier != Job.Tier.STANDARD
    if job.tier == Job.Tier.TOP:
        card_tone = 'green'
    elif job.tier == Job.Tier.FEATURED:
        card_tone = 'orange'
    else:
        card_tone = 'neutral'

    placement = 'legacy_priority' if sponsored else 'organic'

    labels = []
    if sponsored:
        labels.append(
            {
                'code': 'sponsored',
                'text': _('Tài trợ'),
                'tone': 'sponsored',
            }
        )
    if job.is_hot:
        labels.append({'code': 'hot', 'text': 'HOT', 'tone': 'danger'})
    if job.is_urgent:
        labels.append({'code': 'urgent', 'text': _('GẤP'), 'tone': 'warning'})
    if job.has_flash_badge:
        labels.append(
            {
                'code': 'fast_response',
                'text': _('Phản hồi nhanh'),
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
        'placement': placement,
    }
