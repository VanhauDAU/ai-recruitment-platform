"""Commercial Job Alert dispatch with bounded recipient discovery and outbox delivery."""

import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.template.loader import render_to_string
from django.utils import timezone

from apps.jobs.services import job_is_publicly_available
from common.email import send_html_email
from common.metrics import record_metric

from ..models import (
    JobServiceActivation,
    JobServiceActivationItem,
    JobServiceAlertDispatch,
    JobServiceAlertRecipient,
    JobServiceUsageEvent,
    ServiceAuditEvent,
    ServiceCapability,
)
from .entitlements import _validate_actor_company, record_service_audit_event

logger = logging.getLogger(__name__)
MAX_DELIVERY_ATTEMPTS = 4


def _selection_batch_size():
    return max(int(getattr(settings, 'JOB_PROMOTION_ALERT_SELECTION_BATCH_SIZE', 200)), 1)


def _activation_is_effective(activation, at):
    return (
        activation.status == JobServiceActivation.Status.ACTIVE
        and activation.starts_at <= at < activation.ends_at
    )


def _alert_item_for_activation(*, activation, at, lock=False):
    queryset = JobServiceActivationItem.objects.select_related('capability').filter(
        activation=activation,
        capability__code=ServiceCapability.Code.JOB_ALERT,
        starts_at__lte=at,
        ends_at__gt=at,
    )
    return (queryset.select_for_update() if lock else queryset).first()


def _has_matching_recipient(job):
    # Import lazily so the jobs command package can remain the single public
    # dependency boundary without a startup import cycle with entitlements.
    from apps.jobs.services import matching_job_alert_recipient_page

    page = matching_job_alert_recipient_page(job=job, limit=_selection_batch_size())
    return bool(page['recipients'])


def preview_job_service_alert_dispatch(*, activation, actor, at=None):
    at = at or timezone.now()
    _validate_actor_company(actor=actor, company_id=activation.company_id)
    blockers = []
    if not _activation_is_effective(activation, at):
        blockers.append('Dịch vụ không còn trong thời gian hiệu lực.')
    if not job_is_publicly_available(job_id=activation.job_id):
        blockers.append('Tin phải đang công khai và không bị hold.')
    alert_item = _alert_item_for_activation(activation=activation, at=at)
    if alert_item is None:
        blockers.append('Dịch vụ này không có quyền lợi Job Alert đang hiệu lực.')
    elif alert_item.remaining_quantity < 1:
        blockers.append('Quyền lợi Job Alert của dịch vụ này đã được sử dụng hết.')
    elif not blockers and not _has_matching_recipient(activation.job):
        blockers.append('Chưa có ứng viên nào có Job Alert phù hợp với tin này.')
    return {
        'can_dispatch': not blockers,
        'blockers': blockers,
        'remaining_quantity': alert_item.remaining_quantity if alert_item else 0,
        'message': (
            'Chỉ gửi cho ứng viên đã chủ động tạo Job Alert phù hợp, xác thực email '
            'và vẫn bật nhận thông báo việc làm.'
        ),
    }


@transaction.atomic
def create_job_service_alert_dispatch(*, activation, actor, idempotency_key, at=None):
    idempotency_key = str(idempotency_key or '').strip()
    if not idempotency_key:
        raise ValidationError({'idempotency_key': 'Thiếu khóa chống gửi Job Alert trùng.'})
    at = at or timezone.now()
    locked_activation = (
        JobServiceActivation.objects.select_for_update()
        .select_related('unit__package_version', 'job', 'company')
        .get(pk=activation.pk)
    )
    _validate_actor_company(actor=actor, company_id=locked_activation.company_id)
    existing_usage = JobServiceUsageEvent.objects.filter(
        company_id=locked_activation.company_id,
        idempotency_key=idempotency_key,
    ).first()
    if existing_usage:
        try:
            return existing_usage.alert_dispatch
        except JobServiceAlertDispatch.DoesNotExist as error:
            raise ValidationError(
                {'idempotency_key': 'Khóa đã được dùng cho yêu cầu khác.'}
            ) from error

    preview = preview_job_service_alert_dispatch(
        activation=locked_activation,
        actor=actor,
        at=at,
    )
    if not preview['can_dispatch']:
        raise ValidationError({'blockers': preview['blockers']})
    alert_item = _alert_item_for_activation(activation=locked_activation, at=at, lock=True)
    if alert_item is None or alert_item.remaining_quantity < 1:
        raise ValidationError('Quyền lợi Job Alert không còn khả dụng.')

    alert_item.remaining_quantity -= 1
    alert_item.save(update_fields=['remaining_quantity'])
    usage = JobServiceUsageEvent.objects.create(
        activation=locked_activation,
        activation_item=alert_item,
        company=locked_activation.company,
        job=locked_activation.job,
        event_type=JobServiceUsageEvent.EventType.JOB_ALERT,
        idempotency_key=idempotency_key,
        occurred_at=at,
        actor=actor,
        metadata={'remaining_quantity': alert_item.remaining_quantity},
    )
    dispatch = JobServiceAlertDispatch.objects.create(
        usage_event=usage,
        activation=locked_activation,
        activation_item=alert_item,
        company=locked_activation.company,
        job=locked_activation.job,
    )
    record_service_audit_event(
        event_type=ServiceAuditEvent.EventType.CAPABILITY_USED,
        actor=actor,
        company=locked_activation.company,
        package_version=locked_activation.unit.package_version,
        unit=locked_activation.unit,
        activation=locked_activation,
        metadata={
            'capability': ServiceCapability.Code.JOB_ALERT,
            'job_public_id': locked_activation.job.public_id,
            'usage_public_id': usage.public_id,
            'dispatch_public_id': dispatch.public_id,
            'remaining_quantity': alert_item.remaining_quantity,
        },
        occurred_at=at,
    )
    return dispatch


@transaction.atomic
def prepare_job_service_alert_dispatch(*, dispatch_id):
    """Discover one bounded page of candidates and create their private outbox rows."""
    dispatch = (
        JobServiceAlertDispatch.objects.select_for_update(skip_locked=True)
        .select_related('job', 'activation')
        .filter(pk=dispatch_id, selection_finished=False)
        .first()
    )
    if dispatch is None:
        return {'status': 'missing_or_ready', 'recipient_ids': []}
    now = timezone.now()
    if not _activation_is_effective(dispatch.activation, now) or not job_is_publicly_available(
        job_id=dispatch.job_id
    ):
        dispatch.status = JobServiceAlertDispatch.Status.CANCELLED
        dispatch.selection_finished = True
        dispatch.completed_at = now
        dispatch.save(update_fields=['status', 'selection_finished', 'completed_at', 'updated_at'])
        return {
            'status': dispatch.status,
            'selection_finished': True,
            'recipient_ids': [],
        }

    from apps.jobs.services import matching_job_alert_recipient_page

    page = matching_job_alert_recipient_page(
        job=dispatch.job,
        after_alert_id=dispatch.selection_cursor,
        limit=_selection_batch_size(),
    )
    created_ids = []
    for recipient in page['recipients']:
        row, created = JobServiceAlertRecipient.objects.get_or_create(
            dispatch=dispatch,
            candidate_id=recipient['candidate_id'],
            defaults={
                'recipient_email': recipient['recipient_email'],
                'recipient_auth_revision': recipient['recipient_auth_revision'],
                'matched_alert_public_ids': recipient['matched_alert_public_ids'],
            },
        )
        if created:
            created_ids.append(row.pk)
        else:
            matched_alert_ids = list(
                dict.fromkeys(
                    [*row.matched_alert_public_ids, *recipient['matched_alert_public_ids']]
                )
            )
            if matched_alert_ids != row.matched_alert_public_ids:
                row.matched_alert_public_ids = matched_alert_ids
                row.save(update_fields=['matched_alert_public_ids', 'updated_at'])
    recipient_count = dispatch.recipient_count + len(created_ids)
    dispatch.recipient_count = recipient_count
    dispatch.selection_cursor = page['next_cursor']
    dispatch.selection_finished = page['finished']
    if page['finished']:
        dispatch.status = (
            JobServiceAlertDispatch.Status.READY
            if recipient_count > 0
            else JobServiceAlertDispatch.Status.EMPTY
        )
        if dispatch.status == JobServiceAlertDispatch.Status.EMPTY:
            dispatch.completed_at = now
    dispatch.save(
        update_fields=[
            'recipient_count',
            'selection_cursor',
            'selection_finished',
            'status',
            'completed_at',
            'updated_at',
        ]
    )
    dispatch.refresh_from_db(fields=['status', 'selection_finished', 'recipient_count'])
    return {
        'status': dispatch.status,
        'selection_finished': dispatch.selection_finished,
        'recipient_ids': created_ids,
    }


def _recipient_delivery_allowed(recipient):
    dispatch = recipient.dispatch
    candidate = recipient.candidate
    if (
        candidate.email != recipient.recipient_email
        or candidate.auth_revision != recipient.recipient_auth_revision
        or not _activation_is_effective(dispatch.activation, timezone.now())
        or not job_is_publicly_available(job_id=dispatch.job_id)
    ):
        return False
    from apps.jobs.services import candidate_still_allows_promoted_job_alert

    return candidate_still_allows_promoted_job_alert(
        candidate=candidate,
        job=dispatch.job,
        alert_public_ids=recipient.matched_alert_public_ids,
    )


def _recipient_email_context(recipient):
    job = recipient.dispatch.job
    site_name = 'ProCV'
    job_url = f'{settings.FRONTEND_URL.rstrip("/")}/viec-lam/{job.slug}'
    return {
        'site_name': site_name,
        'candidate_name': recipient.candidate.full_name or recipient.candidate.email,
        'job_title': job.title,
        'company_name': job.company.company_name,
        'job_url': job_url,
        'email_settings_url': (f'{settings.FRONTEND_URL.rstrip("/")}/tai-khoan/cai-dat-nhan-email'),
    }


@transaction.atomic
def _finish_alert_dispatch_if_complete(dispatch_id):
    dispatch = JobServiceAlertDispatch.objects.select_for_update().get(pk=dispatch_id)
    if not dispatch.selection_finished or dispatch.status in {
        JobServiceAlertDispatch.Status.CANCELLED,
        JobServiceAlertDispatch.Status.EMPTY,
        JobServiceAlertDispatch.Status.FAILED,
        JobServiceAlertDispatch.Status.SENT,
    }:
        return dispatch.status
    if dispatch.recipients.filter(
        status__in=(
            JobServiceAlertRecipient.Status.PENDING,
            JobServiceAlertRecipient.Status.SENDING,
        )
    ).exists():
        return dispatch.status
    dispatch.refresh_from_db(
        fields=['recipient_count', 'sent_count', 'cancelled_count', 'failed_count']
    )
    if dispatch.sent_count:
        dispatch.status = JobServiceAlertDispatch.Status.SENT
    elif dispatch.failed_count:
        dispatch.status = JobServiceAlertDispatch.Status.FAILED
    else:
        dispatch.status = JobServiceAlertDispatch.Status.CANCELLED
    dispatch.completed_at = timezone.now()
    dispatch.save(update_fields=['status', 'completed_at', 'updated_at'])
    return dispatch.status


def deliver_job_service_alert_recipient(recipient_id):
    """Send one recipient outbox row after a final preference/relevance gate."""
    now = timezone.now()
    with transaction.atomic():
        recipient = (
            JobServiceAlertRecipient.objects.select_for_update()
            .select_related('candidate', 'dispatch__activation', 'dispatch__job__company')
            .filter(pk=recipient_id)
            .first()
        )
        if recipient is None or recipient.status in {
            JobServiceAlertRecipient.Status.SENT,
            JobServiceAlertRecipient.Status.CANCELLED,
            JobServiceAlertRecipient.Status.FAILED,
        }:
            return recipient.status if recipient else 'missing'
        if not _recipient_delivery_allowed(recipient):
            recipient.status = JobServiceAlertRecipient.Status.CANCELLED
            recipient.save(update_fields=['status', 'updated_at'])
            JobServiceAlertDispatch.objects.filter(pk=recipient.dispatch_id).update(
                cancelled_count=F('cancelled_count') + 1
            )
            _finish_alert_dispatch_if_complete(recipient.dispatch_id)
            return recipient.status
        recipient.status = JobServiceAlertRecipient.Status.SENDING
        recipient.started_at = now
        recipient.attempts += 1
        recipient.save(update_fields=['status', 'started_at', 'attempts', 'updated_at'])

    try:
        context = _recipient_email_context(recipient)
        # Preferences and job availability may change while template rendering or
        # queue scheduling is in progress. Recheck at the final SMTP boundary.
        recipient = JobServiceAlertRecipient.objects.select_related(
            'candidate',
            'dispatch__activation',
            'dispatch__job__company',
        ).get(pk=recipient.pk)
        if not _recipient_delivery_allowed(recipient):
            with transaction.atomic():
                locked = JobServiceAlertRecipient.objects.select_for_update().get(pk=recipient.pk)
                if locked.status != JobServiceAlertRecipient.Status.SENDING:
                    return locked.status
                locked.status = JobServiceAlertRecipient.Status.CANCELLED
                locked.save(update_fields=['status', 'updated_at'])
                JobServiceAlertDispatch.objects.filter(pk=locked.dispatch_id).update(
                    cancelled_count=F('cancelled_count') + 1
                )
                _finish_alert_dispatch_if_complete(locked.dispatch_id)
            return JobServiceAlertRecipient.Status.CANCELLED
        send_html_email(
            subject=f'Việc làm phù hợp với Job Alert của bạn · {context["site_name"]}',
            text=render_to_string('services/email/promoted_job_alert.txt', context),
            html=render_to_string('services/email/promoted_job_alert.html', context),
            to=recipient.recipient_email,
            headers={'Message-ID': recipient.message_id},
        )
    except Exception as error:  # noqa: BLE001 - outbox owns retry state
        with transaction.atomic():
            locked = JobServiceAlertRecipient.objects.select_for_update().get(pk=recipient.pk)
            exhausted = locked.attempts >= MAX_DELIVERY_ATTEMPTS
            locked.status = (
                JobServiceAlertRecipient.Status.FAILED
                if exhausted
                else JobServiceAlertRecipient.Status.PENDING
            )
            locked.last_error = str(error)[:2000]
            locked.save(update_fields=['status', 'last_error', 'updated_at'])
            if exhausted:
                JobServiceAlertDispatch.objects.filter(pk=locked.dispatch_id).update(
                    failed_count=F('failed_count') + 1
                )
                _finish_alert_dispatch_if_complete(locked.dispatch_id)
        raise

    with transaction.atomic():
        locked = JobServiceAlertRecipient.objects.select_for_update().get(pk=recipient.pk)
        if locked.status != JobServiceAlertRecipient.Status.SENDING:
            return locked.status
        locked.status = JobServiceAlertRecipient.Status.SENT
        locked.sent_at = timezone.now()
        locked.save(update_fields=['status', 'sent_at', 'updated_at'])
        JobServiceAlertDispatch.objects.filter(pk=locked.dispatch_id).update(
            sent_count=F('sent_count') + 1
        )
        _finish_alert_dispatch_if_complete(locked.dispatch_id)
    record_metric('job_promotion_alert', event='deliver', status='sent')
    return JobServiceAlertRecipient.Status.SENT


def pending_job_service_alert_dispatch_ids(*, limit=100):
    return list(
        JobServiceAlertDispatch.objects.filter(selection_finished=False)
        .order_by('created_at', 'id')
        .values_list('pk', flat=True)[:limit]
    )


def pending_job_service_alert_recipient_ids(*, limit=500):
    return list(
        JobServiceAlertRecipient.objects.filter(status=JobServiceAlertRecipient.Status.PENDING)
        .order_by('created_at', 'id')
        .values_list('pk', flat=True)[:limit]
    )
