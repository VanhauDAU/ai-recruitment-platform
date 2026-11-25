"""Job engagement write use cases with consent-aware Redis deduplication."""

import logging
from hashlib import sha256
from uuid import uuid4

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import connection, transaction
from django.db.models import F
from redis.exceptions import RedisError

from apps.privacy.domain import VIEWER_SIGNING_SALT
from common.metrics import record_metric
from common.vietnam_time import vietnam_today

from ..models import Job, JobEngagementDaily
from .policy import job_view_dedup_seconds

logger = logging.getLogger(__name__)

_DEDUPLICATE_VIEW_SCRIPT = """
for _, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then return 0 end
end
for _, key in ipairs(KEYS) do
  redis.call('SET', key, '1', 'EX', ARGV[1], 'NX')
end
return 1
"""


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


def _dedupe_keys(*, job_id, viewer_id, user_id=None):
    viewer_hash = sha256(viewer_id.encode()).hexdigest()
    keys = [f'job-view:{job_id}:viewer:{viewer_hash}']
    if user_id:
        keys.append(f'job-view:{job_id}:user:{user_id}')
    return keys


def _impression_dedupe_keys(*, job_id, viewer_id, user_id=None):
    viewer_hash = sha256(viewer_id.encode()).hexdigest()
    keys = [f'job-impression:{job_id}:viewer:{viewer_hash}']
    if user_id:
        keys.append(f'job-impression:{job_id}:user:{user_id}')
    return keys


def _claim_first_views(key_groups):
    """Atomically reserve each group of dedupe keys in Redis, in one round trip.

    Returns one result per group: ``True`` for a first view, ``False`` for a
    duplicate and ``None`` for "not counted": without Redis (non-django-redis
    cache or an outage) a view cannot be deduplicated, so it is never counted
    twice.
    """
    client = getattr(cache, 'client', None)
    if client is None:
        return [None] * len(key_groups)
    ttl = job_view_dedup_seconds()
    try:
        pipeline = client.get_client(write=True).pipeline(transaction=False)
        for keys in key_groups:
            redis_keys = [cache.make_key(key) for key in keys]
            pipeline.eval(_DEDUPLICATE_VIEW_SCRIPT, len(redis_keys), *redis_keys, ttl)
        return [bool(result) for result in pipeline.execute()]
    except RedisError:
        logger.warning('Redis unavailable for job engagement dedupe; event not counted.')
        return [None] * len(key_groups)


def _tracking_date():
    """Use the product reporting timezone instead of the project's UTC timezone."""
    return vietnam_today()


ENGAGEMENT_COUNTERS = ('impression_count', 'view_count')


@transaction.atomic
def _increment_engagement(job_ids, *, field):
    """Add one ``field`` event to each job: two statements whatever the batch size.

    ``field`` names the same counter on ``Job`` (lifetime) and on
    ``JobEngagementDaily`` (per Vietnam day), whose row is upserted.
    """
    if field not in ENGAGEMENT_COUNTERS:
        raise ValueError(f'Unknown engagement counter: {field}')
    job_ids = sorted(set(job_ids))
    if not job_ids:
        return
    Job.objects.filter(pk__in=job_ids).update(**{field: F(field) + 1})
    table = JobEngagementDaily._meta.db_table
    tracking_date = _tracking_date()
    params = []
    for job_id in job_ids:
        params += [job_id, tracking_date, *(int(name == field) for name in ENGAGEMENT_COUNTERS)]
    values = ', '.join(['(%s, %s, %s, %s)'] * len(job_ids))
    with connection.cursor() as cursor:
        cursor.execute(
            f'INSERT INTO {table} (job_id, date, impression_count, view_count) VALUES {values} '
            f'ON CONFLICT (job_id, date) DO UPDATE SET {field} = {table}.{field} + EXCLUDED.{field}',
            params,
        )


def record_consented_job_view(request, job):
    """Return a privacy-safe tracking result without exposing identifier data."""
    viewer_id, viewer_created = _viewer_id_from_request(request)
    user_id = request.user.pk if request.user.is_authenticated else None
    [claimed] = _claim_first_views(
        [_dedupe_keys(job_id=job.pk, viewer_id=viewer_id, user_id=user_id)]
    )
    if claimed is None:
        record_metric('job_engagement', event='view', reason='redis_error')
        job.refresh_from_db(fields=['view_count'])
        return {'counted': False, 'view_count': job.view_count, 'reason': 'redis_error'}
    if not claimed:
        record_metric('job_engagement', event='view', reason='duplicate')
        job.refresh_from_db(fields=['view_count'])
        return {'counted': False, 'view_count': job.view_count, 'reason': 'duplicate'}

    _increment_engagement([job.pk], field='view_count')
    record_metric('job_engagement', event='view', reason='counted')
    job.refresh_from_db(fields=['view_count'])
    return {
        'counted': True,
        'view_count': job.view_count,
        'viewer_id': viewer_id if viewer_created else None,
    }


def record_consented_job_impressions(request, jobs):
    """Record a deduplicated impression for every viewable job in one batch.

    One Redis pipeline claims every job, then one UPDATE and one upsert count
    the claimed ones, instead of a round trip and a transaction per job.
    """
    viewer_id, viewer_created = _viewer_id_from_request(request)
    user_id = request.user.pk if request.user.is_authenticated else None
    claims = _claim_first_views(
        [
            _impression_dedupe_keys(job_id=job.pk, viewer_id=viewer_id, user_id=user_id)
            for job in jobs
        ]
    )
    results, counted_ids = [], []
    for job, claimed in zip(jobs, claims, strict=True):
        if claimed is None:
            reason = 'redis_error'
        elif not claimed:
            reason = 'duplicate'
        else:
            reason = 'counted'
            counted_ids.append(job.pk)
        record_metric('job_engagement', event='impression', reason=reason)
        results.append(
            {'slug': job.slug, 'counted': True}
            if reason == 'counted'
            else {'slug': job.slug, 'counted': False, 'reason': reason}
        )
    _increment_engagement(counted_ids, field='impression_count')
    return {
        'results': results,
        'viewer_id': viewer_id if viewer_created else None,
    }


def set_viewer_cookie(response, viewer_id):
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
