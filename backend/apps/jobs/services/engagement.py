"""Job engagement write use cases with consent-aware Redis deduplication."""

from hashlib import sha256
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.privacy.constants import VIEWER_SIGNING_SALT
from common.metrics import record_metric

from ..models import Job, JobEngagementDaily

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


def _claim_first_view(keys):
    """Atomically reserve every dedupe key in Redis, or fail closed."""
    try:
        client = getattr(cache, 'client', None)
        if client is None:
            return None
        redis_client = client.get_client(write=True)
        redis_keys = [cache.make_key(key) for key in keys]
        return bool(
            redis_client.eval(
                _DEDUPLICATE_VIEW_SCRIPT,
                len(redis_keys),
                *redis_keys,
                settings.JOB_VIEW_DEDUP_TTL_SECONDS,
            )
        )
    except Exception:
        return None


def _tracking_date():
    """Use the product reporting timezone instead of the project's UTC timezone."""
    return timezone.localdate(timezone=ZoneInfo('Asia/Ho_Chi_Minh'))


@transaction.atomic
def _increment_engagement(job, *, lifetime_field, daily_field):
    tracking_date = _tracking_date()
    Job.objects.filter(pk=job.pk).update(**{lifetime_field: F(lifetime_field) + 1})
    JobEngagementDaily.objects.get_or_create(job=job, date=tracking_date)
    JobEngagementDaily.objects.filter(job=job, date=tracking_date).update(
        **{daily_field: F(daily_field) + 1}
    )


def record_consented_job_view(request, job):
    """Return a privacy-safe tracking result without exposing identifier data."""
    viewer_id, viewer_created = _viewer_id_from_request(request)
    user_id = request.user.pk if request.user.is_authenticated else None
    claimed = _claim_first_view(_dedupe_keys(job_id=job.pk, viewer_id=viewer_id, user_id=user_id))
    if claimed is None:
        record_metric('job_engagement', event='view', reason='redis_error')
        job.refresh_from_db(fields=['view_count'])
        return {'counted': False, 'view_count': job.view_count, 'reason': 'redis_error'}
    if not claimed:
        record_metric('job_engagement', event='view', reason='duplicate')
        job.refresh_from_db(fields=['view_count'])
        return {'counted': False, 'view_count': job.view_count, 'reason': 'duplicate'}

    _increment_engagement(job, lifetime_field='view_count', daily_field='view_count')
    record_metric('job_engagement', event='view', reason='counted')
    job.refresh_from_db(fields=['view_count'])
    return {
        'counted': True,
        'view_count': job.view_count,
        'viewer_id': viewer_id if viewer_created else None,
    }


def record_consented_job_impressions(request, jobs):
    """Record a deduplicated impression for every viewable job in one batch."""
    viewer_id, viewer_created = _viewer_id_from_request(request)
    user_id = request.user.pk if request.user.is_authenticated else None
    results = []
    for job in jobs:
        claimed = _claim_first_view(
            _impression_dedupe_keys(
                job_id=job.pk,
                viewer_id=viewer_id,
                user_id=user_id,
            )
        )
        if claimed is None:
            record_metric('job_engagement', event='impression', reason='redis_error')
            results.append({'slug': job.slug, 'counted': False, 'reason': 'redis_error'})
            continue
        if not claimed:
            record_metric('job_engagement', event='impression', reason='duplicate')
            results.append({'slug': job.slug, 'counted': False, 'reason': 'duplicate'})
            continue

        _increment_engagement(
            job,
            lifetime_field='impression_count',
            daily_field='impression_count',
        )
        record_metric('job_engagement', event='impression', reason='counted')
        results.append({'slug': job.slug, 'counted': True})

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
