"""Transactional-outbox tasks for security-sensitive authentication emails."""

import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import AuthEmailJob
from ..services import email_verification, password_reset, two_factor, welcome

logger = logging.getLogger(__name__)
MAX_DELIVERY_ATTEMPTS = 4
STALE_SENDING_AFTER = timedelta(minutes=5)


def queue_auth_email(kind, user, context=None, *, unique=False):
    if unique:
        job, created = AuthEmailJob.objects.get_or_create(
            user=user,
            kind=kind,
            defaults={'context': context or {}},
        )
        if not created:
            return None
    else:
        job = AuthEmailJob.objects.create(user=user, kind=kind, context=context or {})

    def dispatch():
        try:
            deliver_auth_email_job.delay(job.pk)
        except Exception:  # noqa: BLE001 - the persisted outbox row is the fallback
            logger.exception('Không thể đưa auth email job %s vào hàng đợi.', job.pk)

    transaction.on_commit(dispatch)
    return job


def queue_welcome_email(user, context=None):
    """Persist exactly one welcome job for a candidate or employer account."""
    if not (user.is_candidate or user.is_employer):
        return None
    return queue_auth_email(
        AuthEmailJob.Kind.WELCOME,
        user,
        context=context,
        unique=True,
    )


def _send(job):
    if job.kind == AuthEmailJob.Kind.VERIFICATION:
        if not job.user.email_verified:
            email_verification.send_verification_email(job.user)
        return
    if job.kind == AuthEmailJob.Kind.WELCOME:
        welcome.send_welcome_email(job.user, context=job.context)
        return
    if job.kind == AuthEmailJob.Kind.PASSWORD_RESET:
        password_reset.send_password_reset_email(job.user)
        return
    if job.kind == AuthEmailJob.Kind.TWO_FACTOR:
        two_factor.send_two_factor_email(
            job.user,
            job.context.get('purpose', two_factor.PURPOSE_LOGIN),
            target=job.context.get('target'),
        )
        return
    raise ValueError(f'Unsupported authentication email kind: {job.kind}')


@shared_task(bind=True, max_retries=MAX_DELIVERY_ATTEMPTS - 1)
def deliver_auth_email_job(self, job_id):
    now = timezone.now()
    with transaction.atomic():
        job = AuthEmailJob.objects.select_for_update().select_related('user').filter(pk=job_id).first()
        if job is None or job.status == AuthEmailJob.Status.SENT:
            return
        if job.status == AuthEmailJob.Status.SENDING and job.started_at and now - job.started_at < STALE_SENDING_AFTER:
            return
        job.status = AuthEmailJob.Status.SENDING
        job.started_at = now
        job.attempts += 1
        job.save(update_fields=['status', 'started_at', 'attempts', 'updated_at'])

    try:
        _send(job)
    except Exception as exc:  # noqa: BLE001 - retry transient SMTP/provider errors
        exhausted = job.attempts >= MAX_DELIVERY_ATTEMPTS
        AuthEmailJob.objects.filter(pk=job.pk).update(
            status=AuthEmailJob.Status.FAILED if exhausted else AuthEmailJob.Status.PENDING,
            last_error=str(exc)[:2000],
        )
        if exhausted:
            logger.exception('Auth email job %s thất bại sau %s lần thử.', job.pk, job.attempts)
            raise
        raise self.retry(exc=exc, countdown=min(2 ** job.attempts, 60))

    AuthEmailJob.objects.filter(pk=job.pk).update(
        status=AuthEmailJob.Status.SENT,
        sent_at=timezone.now(),
        last_error='',
    )


@shared_task
def dispatch_pending_auth_email_jobs():
    stale_before = timezone.now() - STALE_SENDING_AFTER
    jobs = AuthEmailJob.objects.filter(
        Q(status=AuthEmailJob.Status.PENDING)
        | Q(status=AuthEmailJob.Status.SENDING, started_at__lt=stale_before)
    ).values_list('pk', flat=True)[:100]
    for job_id in jobs:
        try:
            deliver_auth_email_job.delay(job_id)
        except Exception:  # noqa: BLE001 - leave row for the next Beat sweep
            logger.exception('Không thể dispatch lại auth email job %s.', job_id)
