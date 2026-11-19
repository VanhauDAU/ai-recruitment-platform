"""Consolidate a candidate's due sources into one capped outbox digest."""

from collections import deque

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.accounts.services import is_account_accessible
from common.metrics import record_metric

from ...models import (
    CandidateFollowedCompanyDigestSchedule,
    CandidateJobDigest,
    CandidateJobDigestItem,
    CandidateJobDigestSchedule,
    JobAlert,
)
from ...models.alert_queries import followed_company_job_matches, strict_job_alert_matches
from ...models.recommendation_queries import recommend_new_jobs_for_candidate_email
from ..alerts import next_job_alert_run
from .eligibility import (
    candidate_email_settings,
    site_email_enabled,
    suitable_prerequisites_allowed,
)
from .scheduling import PREPARATION_CLAIM_LEASE

MAX_DIGEST_JOBS = 10
MAX_MATCHES_PER_SOURCE = 50


def _round_robin_sources(source_queues):
    selected = []
    selected_by_publication = {}
    queues = deque(queue for queue in source_queues if queue)
    while queues:
        queue = queues.popleft()
        item = queue.popleft()
        job = item['job']
        publication_key = (job.pk, job.published_at)
        selected_item = selected_by_publication.get(publication_key)
        if selected_item is not None:
            for public_id in item['source_alert_public_ids']:
                if public_id not in selected_item['source_alert_public_ids']:
                    selected_item['source_alert_public_ids'].append(public_id)
            selected_item['source_alert_fingerprints'].update(item['source_alert_fingerprints'])
            selected_item['includes_suitable_recommendation'] |= item[
                'includes_suitable_recommendation'
            ]
            selected_item['includes_followed_company'] |= item['includes_followed_company']
        elif len(selected) < MAX_DIGEST_JOBS:
            selected.append(item)
            selected_by_publication[publication_key] = item
        if queue:
            queues.append(queue)
    return selected


def _strict_source_queue(alert, now):
    return deque(
        {
            'job': job,
            'source_kind': CandidateJobDigestItem.SourceKind.CONFIGURED_ALERT,
            'source_alert': alert,
            'source_alert_public_ids': [alert.public_id],
            'source_alert_fingerprints': {
                alert.public_id: alert.criteria_fingerprint,
            },
            'includes_suitable_recommendation': False,
            'includes_followed_company': False,
            'match_score': None,
            'match_reasons': [],
        }
        for job in strict_job_alert_matches(
            alert,
            published_before=now,
            limit=MAX_MATCHES_PER_SOURCE,
        )
    )


def _suitable_source_queue(candidate, schedule, now):
    payload = recommend_new_jobs_for_candidate_email(
        candidate,
        published_after=schedule.suitable_cursor_at,
        published_before=now,
        limit=MAX_MATCHES_PER_SOURCE,
    )
    return payload['status'], deque(
        {
            'job': item['job'],
            'source_kind': CandidateJobDigestItem.SourceKind.SUITABLE_RECOMMENDATION,
            'source_alert': None,
            'source_alert_public_ids': [],
            'source_alert_fingerprints': {},
            'includes_suitable_recommendation': True,
            'includes_followed_company': False,
            'match_score': item['match_score'],
            'match_reasons': item['match_reasons'],
        }
        for item in payload['results']
    )


def _followed_company_source_queue(candidate, schedule, now):
    return deque(
        {
            'job': job,
            'source_kind': CandidateJobDigestItem.SourceKind.FOLLOWED_COMPANY,
            'source_alert': None,
            'source_alert_public_ids': [],
            'source_alert_fingerprints': {},
            'includes_suitable_recommendation': False,
            'includes_followed_company': True,
            'match_score': None,
            'match_reasons': [],
        }
        for job in followed_company_job_matches(
            candidate,
            published_after=schedule.cursor_at,
            published_before=now,
            limit=MAX_MATCHES_PER_SOURCE,
        )
    )


@transaction.atomic
def prepare_candidate_job_digest(candidate_id, now=None, claimed_at=None):
    """Consolidate every due source for one locked candidate into one outbox row."""
    now = parse_datetime(now) if isinstance(now, str) else (now or timezone.now())
    claimed_at = parse_datetime(claimed_at) if isinstance(claimed_at, str) else claimed_at
    candidate = get_user_model().objects.select_for_update().filter(pk=candidate_id).first()
    if candidate is None:
        return None

    alert_filters = (
        {
            'updated_at': claimed_at,
            'next_run_at': claimed_at + PREPARATION_CLAIM_LEASE,
        }
        if claimed_at
        else {'next_run_at__lte': now}
    )
    alerts = list(
        JobAlert.objects.select_for_update()
        .filter(candidate=candidate, is_active=True, **alert_filters)
        .prefetch_related('categories')
        .order_by('created_at', 'pk')
    )
    schedule_filters = (
        {
            'updated_at': claimed_at,
            'suitable_next_run_at': claimed_at + PREPARATION_CLAIM_LEASE,
        }
        if claimed_at
        else {'suitable_next_run_at__lte': now}
    )
    schedule = (
        CandidateJobDigestSchedule.objects.select_for_update()
        .filter(
            candidate=candidate,
            **schedule_filters,
        )
        .first()
    )
    followed_filters = (
        {
            'updated_at': claimed_at,
            'next_run_at': claimed_at + PREPARATION_CLAIM_LEASE,
        }
        if claimed_at
        else {'next_run_at__lte': now}
    )
    followed_schedule = (
        CandidateFollowedCompanyDigestSchedule.objects.select_for_update()
        .filter(candidate=candidate, **followed_filters)
        .first()
    )
    if not alerts and schedule is None and followed_schedule is None:
        return None

    source_windows = {
        'alerts': {alert.public_id: alert.cursor_at.isoformat() for alert in alerts},
        'suitable': schedule.suitable_cursor_at.isoformat() if schedule else None,
        'followed': followed_schedule.cursor_at.isoformat() if followed_schedule else None,
    }
    settings_state = candidate_email_settings(candidate)
    common_allowed = bool(
        is_account_accessible(candidate)
        and candidate.is_candidate
        and candidate.email_verified
        and site_email_enabled()
    )
    source_queues = []
    eligible_source_count = 0

    for alert in alerts:
        source_allowed = common_allowed and alert.is_active and settings_state['configured']
        if source_allowed:
            eligible_source_count += 1
            source_queues.append(_strict_source_queue(alert, now))
        else:
            # Disabled windows are intentionally discarded. Eligible windows stay
            # open and successful receipts drain them across capped digests.
            alert.cursor_at = now
        alert.next_run_at = next_job_alert_run(now, alert.frequency)
        alert.updated_at = now

    includes_suitable = False
    if schedule is not None:
        suitable_source_allowed = (
            common_allowed
            and settings_state['suitable']
            and suitable_prerequisites_allowed(candidate)
        )
        suitable_ready = False
        if suitable_source_allowed:
            suitable_status, suitable_queue = _suitable_source_queue(candidate, schedule, now)
            if suitable_status == 'ready':
                suitable_ready = True
                includes_suitable = True
                eligible_source_count += 1
                source_queues.append(suitable_queue)
        if not suitable_ready:
            schedule.suitable_cursor_at = now
        schedule.suitable_next_run_at = next_job_alert_run(now, JobAlert.Frequency.WEEKLY)
        schedule.updated_at = now

    includes_followed = False
    if followed_schedule is not None:
        if common_allowed and settings_state['followed']:
            includes_followed = True
            eligible_source_count += 1
            source_queues.append(_followed_company_source_queue(candidate, followed_schedule, now))
        else:
            followed_schedule.cursor_at = now
        followed_schedule.next_run_at = next_job_alert_run(now, JobAlert.Frequency.DAILY)
        followed_schedule.updated_at = now

    JobAlert.objects.bulk_update(alerts, ['cursor_at', 'next_run_at', 'updated_at'])
    if schedule is not None:
        schedule.save(
            update_fields=[
                'suitable_cursor_at',
                'suitable_next_run_at',
                'updated_at',
            ]
        )
    if followed_schedule is not None:
        followed_schedule.save(update_fields=['cursor_at', 'next_run_at', 'updated_at'])

    selected = _round_robin_sources(source_queues)
    if not selected and not eligible_source_count:
        record_metric(
            'candidate_job_digest',
            event='prepare',
            status=CandidateJobDigest.Status.SKIPPED,
        )
        return None
    digest_status = (
        CandidateJobDigest.Status.PENDING if selected else CandidateJobDigest.Status.EMPTY
    )

    digest = CandidateJobDigest.objects.create(
        candidate=candidate,
        scheduled_for=now,
        source_alert_public_ids=[alert.public_id for alert in alerts],
        includes_suitable_recommendations=includes_suitable,
        includes_followed_companies=includes_followed,
        source_windows=source_windows,
        recipient_email=candidate.email,
        recipient_auth_revision=candidate.auth_revision,
        status=digest_status,
        job_count=len(selected),
    )
    CandidateJobDigestItem.objects.bulk_create(
        [
            CandidateJobDigestItem(
                digest=digest,
                candidate=candidate,
                job=item['job'],
                source_kind=item['source_kind'],
                source_alert=item['source_alert'],
                source_alert_public_ids=item['source_alert_public_ids'],
                source_alert_fingerprints=item['source_alert_fingerprints'],
                includes_suitable_recommendation=item['includes_suitable_recommendation'],
                includes_followed_company=item['includes_followed_company'],
                job_published_at=item['job'].published_at,
                sort_order=index,
                match_score=item['match_score'],
                match_reasons=item['match_reasons'],
            )
            for index, item in enumerate(selected)
        ]
    )
    record_metric(
        'candidate_job_digest',
        value=len(selected),
        event='prepare',
        status=digest_status,
    )
    return digest
