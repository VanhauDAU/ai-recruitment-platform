import logging
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import Case, F, IntegerField, OuterRef, Subquery, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..models import (
    CARD_TONE_PRIORITY,
    PLACEMENT_PRIORITY,
    JobPromotionMetricDaily,
    JobServiceActivation,
    JobServiceActivationItem,
    ServiceCapability,
)

logger = logging.getLogger(__name__)
VIETNAM_TIME_ZONE = ZoneInfo('Asia/Ho_Chi_Minh')
EVENT_FIELDS = {
    'impression': 'impression_count',
    'view': 'view_count',
    'save': 'save_count',
    'apply': 'apply_count',
}


def record_job_promotion_metrics(*, job_ids, event, occurred_at=None):
    """Best-effort aggregate attribution; candidate identity is never persisted."""
    if not getattr(settings, 'JOB_PROMOTION_METRICS_ENABLED', False):
        return 0
    field = EVENT_FIELDS.get(event)
    if field is None:
        raise ValueError(f'Unsupported promotion metric event: {event}')
    job_ids = list(dict.fromkeys(job_id for job_id in job_ids if job_id))
    if not job_ids:
        return 0

    occurred_at = occurred_at or timezone.now()
    try:
        tone_priority = (
            JobServiceActivationItem.objects.filter(
                activation_id=OuterRef('pk'),
                capability__code=ServiceCapability.Code.CARD_TONE,
            )
            .annotate(
                priority=Case(
                    *[
                        When(configuration__tone=tone, then=Value(priority))
                        for tone, priority in CARD_TONE_PRIORITY.items()
                    ],
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )
            .values('priority')[:1]
        )
        activation_ids = list(
            JobServiceActivation.objects.filter(
                job_id__in=job_ids,
                status=JobServiceActivation.Status.ACTIVE,
                starts_at__lte=occurred_at,
                ends_at__gt=occurred_at,
                items__capability__code=ServiceCapability.Code.SPONSORED_PLACEMENT,
                items__starts_at__lte=occurred_at,
                items__ends_at__gt=occurred_at,
            )
            .annotate(
                placement_priority=Case(
                    *[
                        When(items__configuration__placement=value, then=Value(priority))
                        for value, priority in PLACEMENT_PRIORITY.items()
                    ],
                    default=Value(0),
                    output_field=IntegerField(),
                ),
                tone_priority=Coalesce(Subquery(tone_priority), Value(0)),
            )
            .order_by(
                'job_id',
                '-placement_priority',
                '-tone_priority',
                '-ends_at',
                '-id',
            )
            .distinct('job_id')
            .values_list('id', flat=True)
        )
        if not activation_ids:
            return 0
        metric_date = timezone.localdate(occurred_at, timezone=VIETNAM_TIME_ZONE)
        with transaction.atomic():
            JobPromotionMetricDaily.objects.bulk_create(
                [
                    JobPromotionMetricDaily(activation_id=activation_id, date=metric_date)
                    for activation_id in activation_ids
                ],
                ignore_conflicts=True,
            )
            return JobPromotionMetricDaily.objects.filter(
                activation_id__in=activation_ids,
                date=metric_date,
            ).update(**{field: F(field) + 1})
    except Exception:
        logger.exception('Could not record promotion metric event=%s', event)
        return 0
