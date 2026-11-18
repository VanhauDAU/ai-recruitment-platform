"""Consented impression/click/dismiss telemetry with per-viewer daily dedupe."""

import logging
from datetime import timedelta
from hashlib import sha256
from uuid import uuid4

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.db.models import F

from apps.privacy.domain import VIEWER_SIGNING_SALT
from common.metrics import record_metric
from common.vietnam_time import vietnam_now, vietnam_today

from ..models import (
    AnnouncementDailyMetric,
    AnnouncementRevision,
)

logger = logging.getLogger(__name__)


def _viewer_id_from_request(request):
    raw_value = request.COOKIES.get(settings.JOB_VIEWER_COOKIE_NAME)
    if raw_value:
        try:
            value = signing.loads(raw_value, salt=VIEWER_SIGNING_SALT)
            if isinstance(value, str) and value:
                return value, False
        except signing.BadSignature:
            pass
    return str(uuid4()), True


def set_announcement_viewer_cookie(response, viewer_id):
    if not viewer_id:
        return
    response.set_cookie(
        settings.JOB_VIEWER_COOKIE_NAME,
        signing.dumps(viewer_id, salt=VIEWER_SIGNING_SALT, compress=True),
        max_age=settings.JOB_VIEWER_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.JOB_VIEWER_COOKIE_SECURE,
        samesite=settings.JOB_VIEWER_COOKIE_SAMESITE,
        path='/',
    )


def _tracking_date():
    return vietnam_today()


def _dedupe_ttl_seconds():
    local_now = vietnam_now()
    next_day = (local_now + timedelta(days=1)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    return max(int((next_day - local_now).total_seconds()) + 300, 300)


def _claim_unique_event(key):
    # None tells the caller dedupe is unavailable: the event is reported as
    # ``redis_error`` and not counted, so an outage cannot inflate the metrics.
    try:
        return cache.add(key, '1', timeout=_dedupe_ttl_seconds())
    except Exception:  # noqa: BLE001 - any cache backend error degrades to "unknown"
        logger.warning('Announcement dedupe cache unavailable; event not counted.')
        return None


@transaction.atomic
def _increment_announcement_metric(*, revision, surface, event):
    metric, _ = AnnouncementDailyMetric.objects.get_or_create(
        announcement_revision=revision,
        date=_tracking_date(),
        surface=surface,
    )
    fields = {
        'impression': ('impressions', 'unique_impressions'),
        'click': ('clicks', 'unique_clicks'),
        'dismiss': ('dismisses',),
    }[event]
    AnnouncementDailyMetric.objects.filter(pk=metric.pk).update(
        **{field: F(field) + 1 for field in fields}
    )


def attach_published_revisions(events):
    """Keep events that target a published revision shown on that surface.

    Each kept event gains ``revision_object``; the rest are counted as invalid.
    """
    public_ids = {event['public_id'] for event in events}
    revisions = AnnouncementRevision.objects.filter(
        announcement__public_id__in=public_ids,
        published_at__isnull=False,
    ).select_related('announcement')
    revisions_by_key = {
        (revision.announcement.public_id, revision.number): revision for revision in revisions
    }
    valid_events = []
    for event in events:
        revision = revisions_by_key.get((event['public_id'], event['revision']))
        if revision is None or event['surface'] not in revision.surfaces:
            record_metric(
                'announcement_analytics',
                event=event['event'],
                reason='invalid_event',
                surface=event['surface'],
            )
            continue
        valid_events.append({**event, 'revision_object': revision})
    return valid_events


def record_consented_announcement_events(request, events):
    viewer_id, viewer_created = _viewer_id_from_request(request)
    viewer_hash = sha256(viewer_id.encode()).hexdigest()
    user_id = request.user.pk if request.user.is_authenticated else None
    tracking_date = _tracking_date().isoformat()
    results = []
    for event in events:
        revision = event['revision_object']
        identity = f'user:{user_id}' if user_id else f'viewer:{viewer_hash}'
        dedupe_key = (
            f'announcement-event:{revision.pk}:{event["surface"]}:'
            f'{event["event"]}:{tracking_date}:{identity}'
        )
        claimed = _claim_unique_event(dedupe_key)
        reason = 'counted'
        if claimed is None:
            reason = 'redis_error'
        elif not claimed:
            reason = 'duplicate'
        else:
            _increment_announcement_metric(
                revision=revision,
                surface=event['surface'],
                event=event['event'],
            )
        record_metric(
            'announcement_analytics',
            event=event['event'],
            reason=reason,
            surface=event['surface'],
        )
        results.append(reason)
    return {
        'results': results,
        'viewer_id': viewer_id if viewer_created else None,
    }
