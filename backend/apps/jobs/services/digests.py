import logging
from collections import deque
from contextlib import contextmanager
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, models, transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.accounts.services import is_account_accessible
from apps.candidates.models import (
    CandidateConsent,
    CandidateEmailNotificationSettings,
    CandidateJobPreference,
    CandidateProfile,
)
from apps.sitecontent.models import SiteSetting
from common.email import send_html_email
from common.metrics import record_metric

from ..models import (
    CandidateJobDigest,
    CandidateJobDigestItem,
    CandidateJobDigestSchedule,
    CandidateJobEmailReceipt,
    CandidateJobEmailSuppression,
    Job,
    JobAlert,
)
from ..models.alert_queries import strict_job_alert_matches
from ..models.badge_queries import badge_verified_map
from ..models.querysets import active_jobs_queryset
from ..models.recommendation_queries import recommend_new_jobs_for_candidate_email
from .alerts import next_job_alert_run

logger = logging.getLogger(__name__)

MAX_DIGEST_JOBS = 10
MAX_MATCHES_PER_SOURCE = 50
MAX_DUE_CANDIDATES = 100
PREPARATION_CLAIM_LEASE = timedelta(minutes=15)
MAX_DELIVERY_ATTEMPTS = 4
STALE_SENDING_AFTER = timedelta(minutes=5)
DIGEST_HISTORY_RETENTION = timedelta(days=90)
CANDIDATE_DELIVERY_LOCK_NAMESPACE = 0x4A4F42


@contextmanager
def _candidate_delivery_lock(candidate_id):
    """Serialize SMTP for a candidate across workers without holding row locks.

    A crash after SMTP but before the receipt is intrinsically ambiguous. The
    recovered digest reuses its persisted Message-ID so the transport/provider
    has a deterministic idempotency key; PostgreSQL releases this advisory lock
    automatically if the worker connection dies.
    """
    if connection.vendor != 'postgresql':
        yield
        return
    lock_key = (CANDIDATE_DELIVERY_LOCK_NAMESPACE << 32) | int(candidate_id)
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_advisory_lock(%s)', [lock_key])
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_unlock(%s)', [lock_key])


def _site_email_enabled():
    value = (
        SiteSetting.objects.filter(key='email_notifications_enabled')
        .values_list('value', flat=True)
        .first()
    )
    if value is None:
        return True
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().casefold()
        if normalized in {'true', '1', 'yes', 'on'}:
            return True
        if normalized in {'false', '0', 'no', 'off'}:
            return False
    return False


def _candidate_email_settings(user):
    value = (
        CandidateEmailNotificationSettings.objects.filter(candidate_profile__user=user)
        .only('configured_job_alerts', 'suitable_job_recommendations')
        .first()
    )
    return {
        'configured': True if value is None else value.configured_job_alerts,
        'suitable': False if value is None else value.suitable_job_recommendations,
    }


def _suitable_prerequisites_allowed(user):
    profile = (
        CandidateProfile.objects.filter(user=user).only('id', 'job_preferences_configured').first()
    )
    if (
        not profile
        or not profile.job_preferences_configured
        or not CandidateJobPreference.objects.filter(candidate_profile=profile).exists()
    ):
        return False
    return CandidateConsent.objects.filter(
        candidate_profile=profile,
        consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
        decision=CandidateConsent.Decision.GRANTED,
    ).exists()


def initialize_missing_suitable_digest_schedules(now=None):
    """Backstop the on-commit opt-in hook without treating historical defaults as opt-in."""
    now = now or timezone.now()
    missing_ids = list(
        CandidateEmailNotificationSettings.objects.filter(
            suitable_job_recommendations=True,
            candidate_profile__user__role='candidate',
            candidate_profile__user__is_active=True,
            candidate_profile__user__is_deleted=False,
            candidate_profile__user__status='active',
            candidate_profile__user__email_verified=True,
            candidate_profile__job_preferences_configured=True,
            candidate_profile__job_preference__isnull=False,
            candidate_profile__consents__consent_type=(
                CandidateConsent.ConsentType.AI_RECOMMENDATION
            ),
            candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
            candidate_profile__user__job_digest_schedule__isnull=True,
        )
        .order_by('candidate_profile__user_id')
        .values_list('candidate_profile__user_id', flat=True)[:MAX_DUE_CANDIDATES]
    )
    CandidateJobDigestSchedule.objects.bulk_create(
        [
            CandidateJobDigestSchedule(
                candidate_id=candidate_id,
                suitable_cursor_at=now,
                suitable_next_run_at=next_job_alert_run(now, JobAlert.Frequency.WEEKLY),
            )
            for candidate_id in missing_ids
        ],
        ignore_conflicts=True,
    )
    return len(missing_ids)


def remove_ineligible_suitable_digest_schedules():
    """Boundedly remove disabled schedules so a later opt-in starts from then."""
    eligible_candidates = get_user_model().objects.filter(
        role='candidate',
        is_active=True,
        is_deleted=False,
        status='active',
        email_verified=True,
        candidate_profile__job_preferences_configured=True,
        candidate_profile__job_preference__isnull=False,
        candidate_profile__email_notification_settings__suitable_job_recommendations=True,
        candidate_profile__consents__consent_type=(CandidateConsent.ConsentType.AI_RECOMMENDATION),
        candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
    )
    schedule_ids = list(
        CandidateJobDigestSchedule.objects.exclude(
            candidate_id__in=models.Subquery(eligible_candidates.values('pk'))
        )
        .order_by('pk')
        .values_list('pk', flat=True)[:MAX_DUE_CANDIDATES]
    )
    deleted, _ = CandidateJobDigestSchedule.objects.filter(pk__in=schedule_ids).delete()
    return deleted


def _due_candidate_queryset(now):
    notification_settings = CandidateEmailNotificationSettings.objects.filter(
        candidate_profile__user_id=models.OuterRef('pk')
    )
    suitable_allowed = notification_settings.filter(
        suitable_job_recommendations=True,
        candidate_profile__job_preferences_configured=True,
        candidate_profile__job_preference__isnull=False,
        candidate_profile__consents__consent_type=(CandidateConsent.ConsentType.AI_RECOMMENDATION),
        candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
    )
    return (
        get_user_model()
        .objects.filter(
            role='candidate',
            is_active=True,
            is_deleted=False,
            status='active',
            email_verified=True,
        )
        .annotate(
            _configured_due=models.Exists(
                JobAlert.objects.filter(
                    candidate_id=models.OuterRef('pk'),
                    is_active=True,
                    next_run_at__lte=now,
                )
            ),
            _configured_opted_out=models.Exists(
                notification_settings.filter(configured_job_alerts=False)
            ),
            _suitable_due=models.Exists(
                CandidateJobDigestSchedule.objects.filter(
                    candidate_id=models.OuterRef('pk'),
                    suitable_next_run_at__lte=now,
                )
            ),
            _suitable_allowed=models.Exists(suitable_allowed),
        )
        .filter(
            models.Q(_configured_due=True, _configured_opted_out=False)
            | models.Q(_suitable_due=True, _suitable_allowed=True)
        )
        .order_by('pk')
    )


def due_candidate_ids(now=None):
    now = now or timezone.now()
    return list(_due_candidate_queryset(now).values_list('pk', flat=True)[:MAX_DUE_CANDIDATES])


def _advance_sources_without_delivery(candidate_ids, now):
    alerts = list(
        JobAlert.objects.select_for_update()
        .filter(candidate_id__in=candidate_ids, is_active=True, next_run_at__lte=now)
        .order_by('pk')
    )
    for alert in alerts:
        alert.cursor_at = now
        alert.next_run_at = next_job_alert_run(now, alert.frequency)
        alert.updated_at = now
    JobAlert.objects.bulk_update(alerts, ['cursor_at', 'next_run_at', 'updated_at'])

    schedules = list(
        CandidateJobDigestSchedule.objects.select_for_update()
        .filter(candidate_id__in=candidate_ids, suitable_next_run_at__lte=now)
        .order_by('pk')
    )
    for schedule in schedules:
        schedule.suitable_cursor_at = now
        schedule.suitable_next_run_at = next_job_alert_run(now, JobAlert.Frequency.WEEKLY)
        schedule.updated_at = now
    CandidateJobDigestSchedule.objects.bulk_update(
        schedules,
        ['suitable_cursor_at', 'suitable_next_run_at', 'updated_at'],
    )


@transaction.atomic
def claim_due_candidate_job_digest_candidates(now=None):
    """Lease one bounded preparation page so later candidate IDs can progress."""
    now = now or timezone.now()
    remove_ineligible_suitable_digest_schedules()
    initialize_missing_suitable_digest_schedules(now)

    if not _site_email_enabled():
        candidate_ids = list(
            get_user_model()
            .objects.select_for_update()
            .annotate(
                _configured_due=models.Exists(
                    JobAlert.objects.filter(
                        candidate_id=models.OuterRef('pk'),
                        is_active=True,
                        next_run_at__lte=now,
                    )
                ),
                _suitable_due=models.Exists(
                    CandidateJobDigestSchedule.objects.filter(
                        candidate_id=models.OuterRef('pk'),
                        suitable_next_run_at__lte=now,
                    )
                ),
            )
            .filter(models.Q(_configured_due=True) | models.Q(_suitable_due=True))
            .order_by('pk')
            .values_list('pk', flat=True)[:MAX_DUE_CANDIDATES]
        )
        _advance_sources_without_delivery(candidate_ids, now)
        return []

    candidate_ids = list(
        _due_candidate_queryset(now)
        .select_for_update()
        .values_list('pk', flat=True)[:MAX_DUE_CANDIDATES]
    )
    if not candidate_ids:
        return []

    configured_opted_out = set(
        CandidateEmailNotificationSettings.objects.filter(
            candidate_profile__user_id__in=candidate_ids,
            configured_job_alerts=False,
        ).values_list('candidate_profile__user_id', flat=True)
    )
    alerts = list(
        JobAlert.objects.select_for_update()
        .filter(
            candidate_id__in=set(candidate_ids) - configured_opted_out,
            is_active=True,
            next_run_at__lte=now,
        )
        .order_by('pk')
    )
    suitable_candidate_ids = set(
        CandidateEmailNotificationSettings.objects.filter(
            candidate_profile__user_id__in=candidate_ids,
            suitable_job_recommendations=True,
            candidate_profile__job_preferences_configured=True,
            candidate_profile__job_preference__isnull=False,
            candidate_profile__consents__consent_type=(
                CandidateConsent.ConsentType.AI_RECOMMENDATION
            ),
            candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
        ).values_list('candidate_profile__user_id', flat=True)
    )
    schedules = list(
        CandidateJobDigestSchedule.objects.select_for_update()
        .filter(
            candidate_id__in=suitable_candidate_ids,
            suitable_next_run_at__lte=now,
        )
        .order_by('pk')
    )
    lease_until = now + PREPARATION_CLAIM_LEASE
    claimed_candidate_ids = set()
    for alert in alerts:
        alert.next_run_at = lease_until
        alert.updated_at = now
        claimed_candidate_ids.add(alert.candidate_id)
    JobAlert.objects.bulk_update(alerts, ['next_run_at', 'updated_at'])
    for schedule in schedules:
        schedule.suitable_next_run_at = lease_until
        schedule.updated_at = now
        claimed_candidate_ids.add(schedule.candidate_id)
    CandidateJobDigestSchedule.objects.bulk_update(
        schedules,
        ['suitable_next_run_at', 'updated_at'],
    )
    return [
        {'candidate_id': candidate_id, 'claimed_at': now.isoformat()}
        for candidate_id in candidate_ids
        if candidate_id in claimed_candidate_ids
    ]


@transaction.atomic
def release_candidate_job_digest_claim(candidate_id, claimed_at):
    """Make a lease immediately due again when broker publication fails."""
    claimed_at = parse_datetime(claimed_at) if isinstance(claimed_at, str) else claimed_at
    if claimed_at is None:
        return
    lease_until = claimed_at + PREPARATION_CLAIM_LEASE
    JobAlert.objects.filter(
        candidate_id=candidate_id,
        updated_at=claimed_at,
        next_run_at=lease_until,
    ).update(next_run_at=claimed_at)
    CandidateJobDigestSchedule.objects.filter(
        candidate_id=candidate_id,
        updated_at=claimed_at,
        suitable_next_run_at=lease_until,
    ).update(suitable_next_run_at=claimed_at)


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
            'match_score': item['match_score'],
            'match_reasons': item['match_reasons'],
        }
        for item in payload['results']
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
    if not alerts and schedule is None:
        return None

    source_windows = {
        'alerts': {alert.public_id: alert.cursor_at.isoformat() for alert in alerts},
        'suitable': schedule.suitable_cursor_at.isoformat() if schedule else None,
    }
    settings_state = _candidate_email_settings(candidate)
    common_allowed = bool(
        is_account_accessible(candidate)
        and candidate.is_candidate
        and candidate.email_verified
        and _site_email_enabled()
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
            and _suitable_prerequisites_allowed(candidate)
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

    JobAlert.objects.bulk_update(alerts, ['cursor_at', 'next_run_at', 'updated_at'])
    if schedule is not None:
        schedule.save(
            update_fields=[
                'suitable_cursor_at',
                'suitable_next_run_at',
                'updated_at',
            ]
        )

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


def due_candidate_job_digest_candidate_ids(now=None):
    """Bounded, cheap Beat enumeration; expensive preparation runs per candidate."""
    now = now or timezone.now()
    initialize_missing_suitable_digest_schedules(now)
    return due_candidate_ids(now)


def _delivery_gate(digest):
    candidate = get_user_model().objects.filter(pk=digest.candidate_id).first()
    if not (
        candidate
        and is_account_accessible(candidate)
        and candidate.is_candidate
        and candidate.email_verified
        and candidate.email == digest.recipient_email
        and candidate.auth_revision == digest.recipient_auth_revision
        and _site_email_enabled()
    ):
        return candidate, {}, False

    settings_state = _candidate_email_settings(candidate)
    allowed_alert_fingerprints = {}
    if settings_state['configured']:
        allowed_alert_fingerprints = dict(
            JobAlert.objects.filter(
                candidate=candidate,
                public_id__in=digest.source_alert_public_ids,
                is_active=True,
            ).values_list('public_id', 'criteria_fingerprint')
        )
    suitable_allowed = bool(
        digest.includes_suitable_recommendations
        and settings_state['suitable']
        and _suitable_prerequisites_allowed(candidate)
    )
    return candidate, allowed_alert_fingerprints, suitable_allowed


def _eligible_digest_items(
    digest,
    candidate,
    allowed_alert_fingerprints,
    suitable_allowed,
):
    items = list(digest.items.select_related('job', 'source_alert').order_by('sort_order'))
    source_eligible = []
    for item in items:
        item._eligible_source_alert_public_ids = [
            public_id
            for public_id in item.source_alert_public_ids
            if item.source_alert_fingerprints.get(public_id)
            == allowed_alert_fingerprints.get(public_id)
        ]
        item._eligible_suitable_recommendation = bool(
            item.includes_suitable_recommendation and suitable_allowed
        )
        if item._eligible_source_alert_public_ids or item._eligible_suitable_recommendation:
            source_eligible.append(item)
    if not source_eligible:
        return []

    job_ids = [item.job_id for item in source_eligible]
    referenced_alert_public_ids = {
        public_id
        for item in source_eligible
        for public_id in item._eligible_source_alert_public_ids
    }
    matching_job_ids_by_alert = {}
    current_alerts = (
        JobAlert.objects.filter(
            candidate=candidate,
            public_id__in=referenced_alert_public_ids,
            is_active=True,
        )
        .select_related('candidate')
        .prefetch_related('categories')
        .order_by('pk')
    )
    validation_cutoff = timezone.now()
    for alert in current_alerts:
        matching_job_ids_by_alert[alert.public_id] = {
            job.pk
            for job in strict_job_alert_matches(
                alert,
                published_before=validation_cutoff,
                limit=len(job_ids),
                job_ids=job_ids,
                exclude_digest_id=digest.pk,
            )
        }

    for item in source_eligible:
        item._eligible_source_alert_public_ids = [
            public_id
            for public_id in item._eligible_source_alert_public_ids
            if item.job_id in matching_job_ids_by_alert.get(public_id, set())
        ]
    source_eligible = [
        item
        for item in source_eligible
        if item._eligible_source_alert_public_ids or item._eligible_suitable_recommendation
    ]
    if not source_eligible:
        return []

    job_ids = [item.job_id for item in source_eligible]
    current_jobs = {
        job.pk: job
        for job in (
            active_jobs_queryset()
            .filter(pk__in=job_ids)
            .exclude(applications__candidate=candidate)
            .exclude(saved_by__candidate=candidate)
            .distinct()
        )
    }
    already_suppressed = set(
        CandidateJobEmailSuppression.objects.filter(
            candidate=candidate,
            job_id__in=job_ids,
        ).values_list('job_id', flat=True)
    )
    eligible = []
    for item in source_eligible:
        job = current_jobs.get(item.job_id)
        if (
            job is None
            or job.published_at != item.job_published_at
            or item.job_id in already_suppressed
        ):
            continue
        item.job = job
        eligible.append(item)
    return eligible


def _salary_text(job):
    if job.salary_type == Job.SalaryType.NEGOTIABLE:
        return 'Thỏa thuận'

    def amount(value):
        if value is None:
            return ''
        if job.currency == Job.Currency.VND:
            return f'{int(value / 1_000_000)} triệu'
        return f'{int(value):,} {job.currency}'

    if job.salary_type == Job.SalaryType.FROM:
        return f'Từ {amount(job.salary_min)}'
    if job.salary_type == Job.SalaryType.UP_TO:
        return f'Đến {amount(job.salary_max)}'
    if job.salary_min == job.salary_max:
        return amount(job.salary_min or job.salary_max)
    return f'{amount(job.salary_min)} - {amount(job.salary_max)}'.strip(' -')


def _email_context(digest, items):
    alerts = {
        alert.public_id: alert.keyword
        for alert in JobAlert.objects.filter(
            candidate_id=digest.candidate_id,
            public_id__in={
                public_id for item in items for public_id in item._eligible_source_alert_public_ids
            },
        )
    }
    badge_map = badge_verified_map({(item.job.company_id, item.job.posted_by_id) for item in items})
    jobs = []
    for item in items:
        job = item.job
        locations = []
        for workplace in job.job_locations.all():
            province = workplace.location.parent or workplace.location
            if province.name not in locations:
                locations.append(province.name)
        source_labels = [
            alerts[public_id]
            for public_id in item._eligible_source_alert_public_ids
            if public_id in alerts
        ]
        if item._eligible_suitable_recommendation:
            source_labels.append('Việc làm phù hợp')
        badges = []
        if job.tier == Job.Tier.TOP:
            badges.append('TOP')
        elif job.tier == Job.Tier.FEATURED:
            badges.append('Nổi bật')
        if job.is_hot:
            badges.append('HOT')
        if job.is_urgent:
            badges.append('GẤP')
        if job.has_flash_badge:
            badges.append('Phản hồi nhanh')
        if badge_map.get((job.company_id, job.posted_by_id)):
            badges.append('Nhà tuyển dụng đã xác thực')
        jobs.append(
            {
                'title': job.title,
                'company_name': job.company.company_name,
                'locations': ', '.join(locations),
                'salary': _salary_text(job),
                'badges': badges,
                'sources': source_labels,
                'url': f'{settings.FRONTEND_URL.rstrip("/")}/viec-lam/{job.slug}',
            }
        )
    return {
        'site_name': _site_string('site_name', 'ProCV'),
        'candidate_name': digest.candidate.full_name or digest.candidate.email,
        'jobs': jobs,
        'manage_url': (f'{settings.FRONTEND_URL.rstrip("/")}/tai-khoan/cai-dat-thong-bao-viec-lam'),
        'email_settings_url': f'{settings.FRONTEND_URL.rstrip("/")}/tai-khoan/cai-dat-nhan-email',
    }


def _site_string(key, default=''):
    value = SiteSetting.objects.filter(key=key).values_list('value', flat=True).first()
    return value.strip() if isinstance(value, str) and value.strip() else default


def _rewind_failed_digest_sources(digest):
    alert_windows = digest.source_windows.get('alerts', {})
    alerts = list(
        JobAlert.objects.select_for_update().filter(
            candidate_id=digest.candidate_id,
            public_id__in=alert_windows,
            cursor_at=digest.scheduled_for,
        )
    )
    for alert in alerts:
        previous = parse_datetime(alert_windows.get(alert.public_id, ''))
        if previous is not None:
            alert.cursor_at = previous
            alert.updated_at = timezone.now()
    JobAlert.objects.bulk_update(alerts, ['cursor_at', 'updated_at'])

    suitable_window = digest.source_windows.get('suitable')
    if suitable_window:
        schedule = (
            CandidateJobDigestSchedule.objects.select_for_update()
            .filter(
                candidate_id=digest.candidate_id,
                suitable_cursor_at=digest.scheduled_for,
            )
            .first()
        )
        previous = parse_datetime(suitable_window)
        if schedule and previous is not None:
            schedule.suitable_cursor_at = previous
            schedule.save(update_fields=['suitable_cursor_at', 'updated_at'])


def _deliver_candidate_job_digest_locked(digest_id):
    """Claim, revalidate, send and receipt one digest with retry-safe state changes."""
    now = timezone.now()
    with transaction.atomic():
        digest = (
            CandidateJobDigest.objects.select_for_update()
            .select_related('candidate')
            .filter(pk=digest_id)
            .first()
        )
        if digest is None or digest.status in {
            CandidateJobDigest.Status.SENT,
            CandidateJobDigest.Status.EMPTY,
            CandidateJobDigest.Status.SKIPPED,
            CandidateJobDigest.Status.CANCELLED,
            CandidateJobDigest.Status.FAILED,
        }:
            status = digest.status if digest else 'missing'
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=status,
                reason='already_terminal',
            )
            return status
        if (
            digest.status == CandidateJobDigest.Status.SENDING
            and digest.started_at
            and now - digest.started_at < STALE_SENDING_AFTER
        ):
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status='sending',
                reason='already_claimed',
            )
            return 'already_sending'
        candidate, allowed_alert_ids, suitable_allowed = _delivery_gate(digest)
        if candidate is None:
            digest.status = CandidateJobDigest.Status.CANCELLED
            digest.save(update_fields=['status', 'updated_at'])
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=digest.status,
                reason='candidate_unavailable',
            )
            return digest.status
        items = _eligible_digest_items(digest, candidate, allowed_alert_ids, suitable_allowed)
        if not items:
            digest.status = CandidateJobDigest.Status.CANCELLED
            digest.save(update_fields=['status', 'updated_at'])
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=digest.status,
                reason='gate_closed_or_ineligible',
            )
            return digest.status
        digest.status = CandidateJobDigest.Status.SENDING
        digest.started_at = now
        digest.attempts += 1
        digest.job_count = len(items)
        digest.save(update_fields=['status', 'started_at', 'attempts', 'job_count', 'updated_at'])

    try:
        # A final identity/preference check happens after rendering work and directly before SMTP.
        candidate, allowed_alert_ids, suitable_allowed = _delivery_gate(digest)
        if candidate is None:
            CandidateJobDigest.objects.filter(pk=digest.pk).update(
                status=CandidateJobDigest.Status.CANCELLED
            )
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=CandidateJobDigest.Status.CANCELLED,
                reason='candidate_changed_before_send',
            )
            return CandidateJobDigest.Status.CANCELLED
        items = _eligible_digest_items(digest, candidate, allowed_alert_ids, suitable_allowed)
        if not items:
            CandidateJobDigest.objects.filter(pk=digest.pk).update(
                status=CandidateJobDigest.Status.CANCELLED
            )
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=CandidateJobDigest.Status.CANCELLED,
                reason='gate_changed_before_send',
            )
            return CandidateJobDigest.Status.CANCELLED
        context = _email_context(digest, items)
        subject = f'{len(items)} việc làm mới dành cho bạn · {context["site_name"]}'
        text_body = render_to_string('jobs/email/candidate_job_digest.txt', context)
        html_body = render_to_string('jobs/email/candidate_job_digest.html', context)

        # Rendering and badge lookup can be non-trivial. Recheck identity,
        # preferences, publication state and permanent suppression immediately
        # before crossing the irreversible SMTP boundary.
        final_candidate, final_alert_ids, final_suitable_allowed = _delivery_gate(digest)
        final_items = (
            _eligible_digest_items(
                digest,
                final_candidate,
                final_alert_ids,
                final_suitable_allowed,
            )
            if final_candidate is not None
            else []
        )
        if [item.pk for item in final_items] != [item.pk for item in items]:
            CandidateJobDigest.objects.filter(pk=digest.pk).update(
                status=CandidateJobDigest.Status.CANCELLED
            )
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=CandidateJobDigest.Status.CANCELLED,
                reason='gate_changed_before_send',
            )
            return CandidateJobDigest.Status.CANCELLED
        send_html_email(
            subject=subject,
            text=text_body,
            html=html_body,
            to=digest.recipient_email,
            headers={'Message-ID': digest.message_id},
        )
    except Exception as error:  # noqa: BLE001 - persisted outbox owns retry state
        with transaction.atomic():
            locked = CandidateJobDigest.objects.select_for_update().get(pk=digest.pk)
            exhausted = locked.attempts >= MAX_DELIVERY_ATTEMPTS
            locked.status = (
                CandidateJobDigest.Status.FAILED if exhausted else CandidateJobDigest.Status.PENDING
            )
            locked.last_error = str(error)[:2000]
            locked.save(update_fields=['status', 'last_error', 'updated_at'])
            if exhausted:
                _rewind_failed_digest_sources(locked)
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status=locked.status,
                reason='provider_error',
            )
        raise

    sent_at = timezone.now()
    with transaction.atomic():
        locked = CandidateJobDigest.objects.select_for_update().get(pk=digest.pk)
        CandidateJobEmailReceipt.objects.bulk_create(
            [
                CandidateJobEmailReceipt(
                    candidate_id=locked.candidate_id,
                    job_id=item.job_id,
                    job_published_at=item.job_published_at,
                    digest=locked,
                    sent_at=sent_at,
                )
                for item in items
            ],
            ignore_conflicts=True,
        )
        CandidateJobEmailSuppression.objects.bulk_create(
            [
                CandidateJobEmailSuppression(
                    candidate_id=locked.candidate_id,
                    job_id=item.job_id,
                    first_sent_at=sent_at,
                )
                for item in items
            ],
            ignore_conflicts=True,
        )
        locked.status = CandidateJobDigest.Status.SENT
        locked.sent_at = sent_at
        locked.last_error = ''
        locked.job_count = len(items)
        locked.save(update_fields=['status', 'sent_at', 'last_error', 'job_count', 'updated_at'])
    record_metric(
        'candidate_job_digest',
        value=len(items),
        event='deliver',
        status=CandidateJobDigest.Status.SENT,
    )
    return CandidateJobDigest.Status.SENT


def deliver_candidate_job_digest(digest_id):
    candidate_id = (
        CandidateJobDigest.objects.filter(pk=digest_id)
        .values_list('candidate_id', flat=True)
        .first()
    )
    if candidate_id is None:
        record_metric(
            'candidate_job_digest',
            event='deliver',
            status='missing',
            reason='already_terminal',
        )
        return 'missing'
    with _candidate_delivery_lock(candidate_id):
        return _deliver_candidate_job_digest_locked(digest_id)


def pending_candidate_job_digest_ids(limit=100):
    stale_before = timezone.now() - STALE_SENDING_AFTER
    return list(
        CandidateJobDigest.objects.filter(
            models.Q(status=CandidateJobDigest.Status.PENDING)
            | models.Q(
                status=CandidateJobDigest.Status.SENDING,
                started_at__lt=stale_before,
            )
        )
        .order_by('created_at')
        .values_list('pk', flat=True)[:limit]
    )


@transaction.atomic
def purge_candidate_job_digest_history(now=None):
    """Delete terminal outbox history and successful receipts after 90 days."""
    cutoff = (now or timezone.now()) - DIGEST_HISTORY_RETENTION
    receipt_count, _ = CandidateJobEmailReceipt.objects.filter(sent_at__lt=cutoff).delete()
    expired_digests = CandidateJobDigest.objects.filter(created_at__lt=cutoff).exclude(
        status__in=(
            CandidateJobDigest.Status.PENDING,
            CandidateJobDigest.Status.SENDING,
        )
    )
    digest_count = expired_digests.count()
    expired_digests.delete()
    record_metric(
        'candidate_job_digest',
        value=digest_count,
        event='retention',
        status='digests_purged',
    )
    record_metric(
        'candidate_job_digest',
        value=receipt_count,
        event='retention',
        status='receipts_purged',
    )
    return {'digests': digest_count, 'receipts': receipt_count}
