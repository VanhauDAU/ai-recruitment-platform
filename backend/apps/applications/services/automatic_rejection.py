"""Automatic cleanup of stale candidate applications and its notifications."""

from collections import defaultdict
from datetime import timedelta
from html import escape

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import ngettext

from apps.jobs.models import Job, JobApplicationContact
from apps.sitecontent.selectors import business_emails_enabled, email_sender
from common.email import send_html_email
from common.i18n import recipient_language

from ..models import Application, ApplicationStatusHistory
from .policy import auto_rejection_email_grace, auto_rejection_min_notice
from .status import (
    notify_candidate_of_status,
)

# The recruiter is warned this long before; an undo also guarantees it.


def _due_before(moment):
    """Unanswered applications whose automatic rejection falls due before ``moment``.

    Counted from the submission (opening the CV does not restart it); an undo
    near the deadline may push it to ``auto_reject_due_floor``.
    """
    by_delay = Q()
    for days, _label in Job.AUTO_REJECTION_AFTER_DAY_CHOICES:
        by_delay |= Q(
            job__auto_reject_after_days=days, applied_at__lte=moment - timedelta(days=days)
        )
    floor_passed = Q(auto_reject_due_floor__isnull=True) | Q(auto_reject_due_floor__lte=moment)
    return by_delay & floor_passed


def _age_filter(now, *, reminder=False):
    # Replaced submissions are history; only the current one can go stale.
    if reminder:
        return (
            Q(is_current=True) & _due_before(now + auto_rejection_min_notice()) & ~_due_before(now)
        )
    return Q(is_current=True) & _due_before(now)


def _render_candidate_body(application):
    job = application.job
    replacements = {
        '{job_title}': job.title,
        '{company_name}': job.company.company_name,
        '{auto_reject_weeks}': str(job.auto_reject_after_days // 7),
    }
    body = job.auto_rejection_email_body
    for placeholder, value in replacements.items():
        body = body.replace(placeholder, value)
    return body


def _email_html(body, *, action_url=None, action_label=None):
    paragraphs = ''.join(
        f'<p style="margin:0 0 12px">{escape(paragraph).replace(chr(10), "<br>")}</p>'
        for paragraph in body.split('\n\n')
    )
    if action_url and action_label:
        paragraphs += (
            f'<p><a href="{escape(action_url)}" style="color:#047857;font-weight:600">'
            f'{escape(action_label)}</a></p>'
        )
    return f'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#334155">{paragraphs}</div>'


def send_due_application_reminders(*, now=None, batch_size=200):
    """Send one recruiter reminder per job for applications entering their grace window."""
    now = now or timezone.now()
    due = list(
        Application.objects.filter(
            _age_filter(now, reminder=True),
            job__auto_reject_stale_applications=True,
            status__in=Application.UNANSWERED_STATUSES,
            auto_rejection_reminder_sent_at__isnull=True,
        )
        .select_related('job', 'job__posted_by')
        .prefetch_related('job__application_contact__emails')
        .order_by('job_id', 'applied_at', 'pk')[:batch_size]
    )
    by_job = defaultdict(list)
    for application in due:
        by_job[application.job_id].append(application)

    sent = 0
    for applications in by_job.values():
        job = applications[0].job
        try:
            recipients = [item.email for item in job.application_contact.emails.all()]
        except JobApplicationContact.DoesNotExist:
            recipients = []
        recipients = list(dict.fromkeys(recipients or [job.posted_by.email]))
        count = len(applications)
        action_url = (
            f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}/tuyendung/app/ho-so-ung-tuyen'
            f'?job={job.public_id}'
        )
        # Contact addresses may not be accounts; the job's poster sets the language.
        with recipient_language(job.posted_by):
            body = ngettext(
                '%(count)s hồ sơ ứng tuyển vị trí %(job)s sẽ tự động chuyển sang “Không phù hợp” '
                'trong vòng 3 ngày nếu bạn chưa đưa ra quyết định.',
                '%(count)s hồ sơ ứng tuyển vị trí %(job)s sẽ tự động chuyển sang “Không phù hợp” '
                'trong vòng 3 ngày nếu bạn chưa đưa ra quyết định.',
                count,
            ) % {'count': count, 'job': job.title}
            subject = _('Nhắc xử lý hồ sơ ứng tuyển — %(job)s') % {'job': job.title}
            text = _('%(body)s\n\nXem hồ sơ: %(url)s') % {'body': body, 'url': action_url}
            html = _email_html(body, action_url=action_url, action_label=_('Xem hồ sơ ứng tuyển'))
        # Admin tắt email nghiệp vụ thì vẫn đánh dấu đã nhắc để không gửi bù hàng loạt khi bật lại.
        if business_emails_enabled():
            for recipient in recipients:
                send_html_email(
                    subject=subject, text=text, html=html, to=recipient, **email_sender()
                )
        application_ids = [application.pk for application in applications]
        Application.objects.filter(
            pk__in=application_ids,
            auto_rejection_reminder_sent_at__isnull=True,
        ).update(auto_rejection_reminder_sent_at=now)
        sent += count
    return sent


def reject_due_applications(*, now=None, batch_size=200):
    """Move stale, non-terminal applications to rejected with an auditable history row."""
    now = now or timezone.now()
    ids = list(
        Application.objects.filter(
            _age_filter(now),
            job__auto_reject_stale_applications=True,
            status__in=Application.UNANSWERED_STATUSES,
        )
        .order_by('applied_at', 'pk')
        .values_list('pk', flat=True)[:batch_size]
    )
    rejected = 0
    for application_id in ids:
        with transaction.atomic():
            application = (
                Application.objects.select_for_update(of=('self',))
                .select_related('candidate', 'job', 'job__company', 'job__posted_by')
                .get(pk=application_id)
            )
            if (
                not application.job.auto_reject_stale_applications
                or application.status not in Application.UNANSWERED_STATUSES
                or application.auto_reject_due_at > now
            ):
                continue
            previous_status = application.status
            application.status = Application.Status.REJECTED
            application.rejected_at = now
            application.status_updated_at = now
            application.auto_rejected_at = now
            application.save(
                update_fields=[
                    'status',
                    'rejected_at',
                    'status_updated_at',
                    'auto_rejected_at',
                    'updated_at',
                ]
            )
            # The recruiter reads this history note, so it is in their language.
            with recipient_language(application.job.posted_by):
                note = _('Tự động chuyển sang Không phù hợp do quá hạn xử lý.')
            history = ApplicationStatusHistory.objects.create(
                application=application,
                from_status=previous_status,
                to_status=Application.Status.REJECTED,
                note=note,
            )
            # The in-app notice waits out the same undo window as the email;
            # the per-job email below stays the only email for this path.
            notify_candidate_of_status(
                application,
                history,
                deliver_after=now + auto_rejection_email_grace(),
                send_email=False,
            )
            rejected += 1
    return rejected


def send_due_auto_rejection_emails(*, now=None, batch_size=200):
    """Notify candidates only after the three-day undo window has elapsed."""
    now = now or timezone.now()
    applications = list(
        Application.objects.filter(
            status=Application.Status.REJECTED,
            auto_rejected_at__lte=now - auto_rejection_email_grace(),
            auto_rejection_email_sent_at__isnull=True,
        )
        .select_related('candidate', 'job', 'job__company')
        .order_by('auto_rejected_at', 'pk')[:batch_size]
    )
    sent = 0
    for application in applications:
        body = _render_candidate_body(application)
        recipient = application.contact_email or application.candidate.email
        with recipient_language(application.candidate):
            subject = _('Kết quả ứng tuyển vị trí %(job)s') % {'job': application.job.title}
        if business_emails_enabled():
            send_html_email(
                subject=subject,
                text=body,
                html=_email_html(body),
                to=recipient,
                **email_sender(),
            )
        updated = Application.objects.filter(
            pk=application.pk,
            status=Application.Status.REJECTED,
            auto_rejected_at=application.auto_rejected_at,
            auto_rejection_email_sent_at__isnull=True,
        ).update(auto_rejection_email_sent_at=now)
        sent += updated
    return sent


def process_automatic_application_rejections(*, now=None, batch_size=200):
    now = now or timezone.now()
    return {
        'reminded': send_due_application_reminders(now=now, batch_size=batch_size),
        'rejected': reject_due_applications(now=now, batch_size=batch_size),
        'notified': send_due_auto_rejection_emails(now=now, batch_size=batch_size),
    }
