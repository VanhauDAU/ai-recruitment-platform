"""Transactional-outbox delivery for employer verification status emails."""

import html
import logging

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.sitecontent.selectors import email_sender, get_string_setting
from common.email import send_html_email
from common.i18n import recipient_language
from common.outbox import MAX_DELIVERY_ATTEMPTS, is_sending_fresh, stale_sending_before

from ..models import EmployerVerificationNotification

logger = logging.getLogger(__name__)


def _render(job, site_name):
    """Subject, text and HTML in the active (recipient's) language."""
    labels = {
        'approved': _('Hồ sơ xác thực đã được duyệt'),
        'changes_requested': _('Hồ sơ xác thực cần bổ sung'),
        'rejected': _('Hồ sơ xác thực bị từ chối'),
        'document_changes_requested': _('Giấy tờ xác thực cần bổ sung'),
        'document_rejected': _('Giấy tờ xác thực bị từ chối'),
    }
    title = labels.get(job.event_type) or _('Trạng thái xác thực đã thay đổi')
    reason = str(job.context.get('reason', '')).strip()
    action_url = f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}/tuyendung/app/xac-thuc-tai-khoan'
    unlocked = (
        _(
            'Bạn đã có thể gửi tin tuyển dụng sang kiểm duyệt và sử dụng các workflow '
            'được phép để xử lý hồ sơ ứng viên.'
        )
        if job.event_type == 'approved'
        else _('Đăng nhập để xem đúng bước cần hoàn thiện hoặc nộp lại.')
    )
    text = (
        _('%(title)s. %(reason)s %(unlocked)s Xem chi tiết: %(url)s')
        % {'title': title, 'reason': reason, 'unlocked': unlocked, 'url': action_url}
    ).strip()
    body = (
        f'<h2>{html.escape(title)}</h2>'
        f'{f"<p>{html.escape(reason)}</p>" if reason else ""}'
        f'<p>{html.escape(unlocked)}</p>'
        f'<p><a href="{html.escape(action_url)}">{html.escape(_("Mở trang xác thực"))}</a></p>'
    )
    return f'{title} · {site_name}', text, body


def _send(job):
    site_name = get_string_setting('site_name', 'ProCV')
    with recipient_language(job.recipient):
        subject, text, body = _render(job, site_name)
    send_html_email(subject=subject, text=text, html=body, to=job.recipient.email, **email_sender())


@shared_task(bind=True, max_retries=MAX_DELIVERY_ATTEMPTS - 1)
def deliver_employer_verification_notification(self, job_id):
    now = timezone.now()
    with transaction.atomic():
        job = (
            EmployerVerificationNotification.objects.select_for_update()
            .select_related('recipient')
            .filter(pk=job_id)
            .first()
        )
        if job is None or job.status == EmployerVerificationNotification.Status.SENT:
            return
        if job.status == EmployerVerificationNotification.Status.SENDING and is_sending_fresh(
            job.started_at, now
        ):
            return
        job.status = EmployerVerificationNotification.Status.SENDING
        job.started_at = now
        job.attempts += 1
        job.save(update_fields=['status', 'started_at', 'attempts', 'updated_at'])

    try:
        _send(job)
    except Exception as error:  # noqa: BLE001 - persisted outbox is the fallback
        exhausted = job.attempts >= MAX_DELIVERY_ATTEMPTS
        EmployerVerificationNotification.objects.filter(pk=job.pk).update(
            status=(
                EmployerVerificationNotification.Status.FAILED
                if exhausted
                else EmployerVerificationNotification.Status.PENDING
            ),
            last_error=str(error)[:2000],
        )
        if exhausted:
            logger.exception('Employer verification email %s exhausted retries.', job.pk)
            raise
        raise self.retry(exc=error, countdown=min(2**job.attempts, 60)) from error

    EmployerVerificationNotification.objects.filter(pk=job.pk).update(
        status=EmployerVerificationNotification.Status.SENT,
        sent_at=timezone.now(),
        last_error='',
    )


@shared_task
def dispatch_pending_employer_verification_notifications():
    stale_before = stale_sending_before(timezone.now())
    job_ids = EmployerVerificationNotification.objects.filter(
        Q(status=EmployerVerificationNotification.Status.PENDING)
        | Q(
            status=EmployerVerificationNotification.Status.SENDING,
            started_at__lt=stale_before,
        )
    ).values_list('pk', flat=True)[:100]
    for job_id in job_ids:
        try:
            deliver_employer_verification_notification.delay(job_id)
        except Exception:  # noqa: BLE001 - leave row for the next sweep
            logger.exception('Could not dispatch employer verification email %s.', job_id)
