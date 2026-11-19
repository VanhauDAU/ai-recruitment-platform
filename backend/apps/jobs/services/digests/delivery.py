"""Retry-safe SMTP delivery of a prepared digest and its receipts."""

from contextlib import contextmanager

from django.conf import settings
from django.db import connection, models, transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.translation import gettext as _
from django.utils.translation import ngettext

from apps.employers.services import employer_badge_state_map
from apps.sitecontent.models import SiteSetting
from common.email import send_html_email
from common.i18n import recipient_language
from common.metrics import record_metric
from common.outbox import MAX_DELIVERY_ATTEMPTS, is_sending_fresh, stale_sending_before

from ...models import (
    CandidateFollowedCompanyDigestSchedule,
    CandidateJobDigest,
    CandidateJobDigestSchedule,
    CandidateJobEmailReceipt,
    CandidateJobEmailSuppression,
    JobAlert,
)
from ..email_cards import job_email_card
from .revalidation import delivery_gate, eligible_digest_items

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
    badge_map = {
        key: state['verified']
        for key, state in employer_badge_state_map(
            {(item.job.company_id, item.job.posted_by_id) for item in items}
        ).items()
    }
    jobs = []
    for item in items:
        job = item.job
        source_labels = [
            alerts[public_id]
            for public_id in item._eligible_source_alert_public_ids
            if public_id in alerts
        ]
        if item._eligible_suitable_recommendation:
            source_labels.append(_('Việc làm phù hợp'))
        jobs.append(
            {
                **job_email_card(
                    job,
                    verified_employer=bool(badge_map.get((job.company_id, job.posted_by_id))),
                ),
                'sources': source_labels,
                'followed_company': (
                    job.company.company_name if item._eligible_followed_company else ''
                ),
            }
        )
    site_name = _site_string('site_name', 'ProCV')
    return {
        'site_name': site_name,
        'candidate_name': digest.candidate.full_name or digest.candidate.email,
        'jobs': jobs,
        'intro_text': ngettext(
            '%(site)s có %(count)s việc làm mới dành cho bạn:',
            '%(site)s có %(count)s việc làm mới dành cho bạn:',
            len(jobs),
        )
        % {'site': site_name, 'count': len(jobs)},
        'intro_html': ngettext(
            'Có %(count)s việc làm mới phù hợp với thông báo bạn đã bật.',
            'Có %(count)s việc làm mới phù hợp với thông báo bạn đã bật.',
            len(jobs),
        )
        % {'count': len(jobs)},
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

    followed_window = digest.source_windows.get('followed')
    if followed_window:
        previous = parse_datetime(followed_window)
        if previous is not None:
            CandidateFollowedCompanyDigestSchedule.objects.filter(
                candidate_id=digest.candidate_id,
                cursor_at=digest.scheduled_for,
            ).update(cursor_at=previous, updated_at=timezone.now())


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
        if digest.status == CandidateJobDigest.Status.SENDING and is_sending_fresh(
            digest.started_at, now
        ):
            record_metric(
                'candidate_job_digest',
                event='deliver',
                status='sending',
                reason='already_claimed',
            )
            return 'already_sending'
        candidate, allowed_alert_ids, suitable_allowed, followed_allowed = delivery_gate(digest)
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
        items = eligible_digest_items(
            digest, candidate, allowed_alert_ids, suitable_allowed, followed_allowed
        )
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
        candidate, allowed_alert_ids, suitable_allowed, followed_allowed = delivery_gate(digest)
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
        items = eligible_digest_items(
            digest, candidate, allowed_alert_ids, suitable_allowed, followed_allowed
        )
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
        # The email is read by the candidate, so it follows their language.
        with recipient_language(candidate):
            context = _email_context(digest, items)
            subject = ngettext(
                '%(count)s việc làm mới dành cho bạn · %(site)s',
                '%(count)s việc làm mới dành cho bạn · %(site)s',
                len(items),
            ) % {'count': len(items), 'site': context['site_name']}
            text_body = render_to_string('jobs/email/candidate_job_digest.txt', context)
            html_body = render_to_string('jobs/email/candidate_job_digest.html', context)

        # Rendering and badge lookup can be non-trivial. Recheck identity,
        # preferences, publication state and permanent suppression immediately
        # before crossing the irreversible SMTP boundary.
        final_candidate, final_alert_ids, final_suitable_allowed, final_followed_allowed = (
            delivery_gate(digest)
        )
        final_items = (
            eligible_digest_items(
                digest,
                final_candidate,
                final_alert_ids,
                final_suitable_allowed,
                final_followed_allowed,
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
    stale_before = stale_sending_before(timezone.now())
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
