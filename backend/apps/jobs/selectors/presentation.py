from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Prefetch, prefetch_related_objects
from django.utils import timezone

from apps.services.models import JobServiceActivation, JobServiceActivationItem

from ..models import Job

VIETNAM_TIME_ZONE = ZoneInfo('Asia/Ho_Chi_Minh')
CARD_TONE_PRIORITY = {'neutral': 0, 'orange': 1, 'green': 2, 'green_strong': 3}
PLACEMENT_PRIORITY = {'organic': 0, 'search_sponsored': 1, 'best_jobs_eligible': 2}


def effective_service_presentations_prefetch(*, lookup='service_activations', at=None):
    """Build the nested active-effect prefetch shared by candidate read models."""
    if not getattr(settings, 'JOB_PRESENTATION_V2_ENABLED', False):
        return None
    at = at or timezone.now()
    active_items = (
        JobServiceActivationItem.objects.filter(starts_at__lte=at, ends_at__gt=at)
        .select_related('capability')
        .order_by('id')
    )
    active_activations = (
        JobServiceActivation.objects.filter(
            status=JobServiceActivation.Status.ACTIVE,
            starts_at__lte=at,
            ends_at__gt=at,
        )
        .order_by('ends_at', 'id')
        .prefetch_related(
            Prefetch('items', queryset=active_items, to_attr='effective_presentation_items')
        )
    )
    return Prefetch(
        lookup,
        queryset=active_activations,
        to_attr='effective_service_activations',
    )


def with_effective_service_presentations(queryset, *, at=None):
    """Prefetch active commercial effects with a constant two-query overhead."""
    activation_prefetch = effective_service_presentations_prefetch(at=at)
    return queryset.prefetch_related(activation_prefetch) if activation_prefetch else queryset


def prime_effective_service_presentations(jobs, *, at=None):
    """Attach effects to an already-materialized bounded recommendation result."""
    jobs = list(jobs)
    activation_prefetch = effective_service_presentations_prefetch(at=at)
    if jobs and activation_prefetch:
        prefetch_related_objects(jobs, activation_prefetch)
    return jobs


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
    """Resolve one query-free projection from prefetched commercial and legacy state."""
    sponsored = job.tier != Job.Tier.STANDARD
    if job.tier == Job.Tier.TOP:
        card_tone = 'green'
    elif job.tier == Job.Tier.FEATURED:
        card_tone = 'orange'
    else:
        card_tone = 'neutral'

    placement = 'legacy_priority' if sponsored else 'organic'
    display_reason = ''
    commercial_active_until = []
    commercial_urgent = False
    if getattr(settings, 'JOB_PRESENTATION_V2_ENABLED', False):
        for activation in getattr(job, 'effective_service_activations', ()):
            for item in getattr(activation, 'effective_presentation_items', ()):
                code = item.capability.code
                if code == 'sponsored_placement':
                    sponsored = True
                    next_placement = item.configuration.get('placement', 'search_sponsored')
                    if PLACEMENT_PRIORITY.get(next_placement, 0) > PLACEMENT_PRIORITY.get(
                        placement, 0
                    ):
                        placement = next_placement
                    display_reason = 'Tin được tài trợ bởi nhà tuyển dụng.'
                    commercial_active_until.append(item.ends_at)
                elif code == 'card_tone':
                    sponsored = True
                    display_reason = 'Tin được tài trợ bởi nhà tuyển dụng.'
                    next_tone = item.configuration.get('tone', 'neutral')
                    if CARD_TONE_PRIORITY.get(next_tone, 0) > CARD_TONE_PRIORITY.get(card_tone, 0):
                        card_tone = next_tone
                    commercial_active_until.append(item.ends_at)
                elif code == 'urgent_label':
                    sponsored = True
                    display_reason = 'Tin được tài trợ bởi nhà tuyển dụng.'
                    commercial_urgent = True
                    commercial_active_until.append(item.ends_at)

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
    if job.is_urgent or commercial_urgent:
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
    if commercial_active_until:
        active_until = min(value for value in [active_until, *commercial_active_until] if value)
    return {
        'sponsored': sponsored,
        'card_tone': card_tone,
        'labels': labels,
        'display_reason': display_reason,
        'active_until': timezone.localtime(active_until, VIETNAM_TIME_ZONE)
        if active_until
        else None,
        'placement': placement,
    }
