"""Automatic cleanup of stale candidate applications and its notifications."""

from collections import defaultdict
from datetime import timedelta
from html import escape

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.jobs.models import Job, JobApplicationContact
from common.email import send_html_email

from ..models import Application, ApplicationStatusHistory

AUTO_REJECTION_EMAIL_GRACE = timedelta(days=3)
REMINDER_LEAD_TIME = timedelta(days=3)
STALE_STATUSES = (
    Application.Status.SUBMITTED,
    Application.Status.VIEWED,
    Application.Status.CONSIDERING,
)


def _age_filter(now, *, reminder=False):
    query = Q()
    for days, _label in Job.AUTO_REJECTION_AFTER_DAY_CHOICES:
        condition = Q(
            job__auto_reject_after_days=days,
            status_updated_at__lte=now - timedelta(days=days),
        )
        if reminder:
            condition = Q(
                job__auto_reject_after_days=days,
                status_updated_at__lte=now - timedelta(days=days) + REMINDER_LEAD_TIME,
                status_updated_at__gt=now - timedelta(days=days),
            )
        query |= condition
    return query


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
            status__in=STALE_STATUSES,
            auto_rejection_reminder_sent_at__isnull=True,
        )
        .select_related('job', 'job__posted_by')
        .prefetch_related('job__application_contact__emails')
        .order_by('job_id', 'status_updated_at', 'pk')[:batch_size]
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
        body = (
            f'{count} hồ sơ ứng tuyển vị trí {job.title} sẽ tự động chuyển sang “Không đạt” '
            f'trong vòng 3 ngày nếu chưa được cập nhật trạng thái.'
        )
        action_url = (
            f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}/tuyendung/app/applications'
            f'?job={job.public_id}'
        )
        for recipient in recipients:
            send_html_email(
                subject=f'Nhắc xử lý hồ sơ ứng tuyển — {job.title}',
                text=f'{body}\n\nXem hồ sơ: {action_url}',
                html=_email_html(body, action_url=action_url, action_label='Xem hồ sơ ứng tuyển'),
                to=recipient,
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
            status__in=STALE_STATUSES,
        )
        .order_by('status_updated_at', 'pk')
        .values_list('pk', flat=True)[:batch_size]
    )
    rejected = 0
    for application_id in ids:
        with transaction.atomic():
            application = (
                Application.objects.select_for_update().select_related('job').get(pk=application_id)
            )
            cutoff = now - timedelta(days=application.job.auto_reject_after_days)
            if (
                not application.job.auto_reject_stale_applications
                or application.status not in STALE_STATUSES
                or application.status_updated_at > cutoff
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
            ApplicationStatusHistory.objects.create(
                application=application,
                from_status=previous_status,
                to_status=Application.Status.REJECTED,
                note='Tự động chuyển sang Không đạt do quá hạn xử lý.',
            )
            rejected += 1
    return rejected


def send_due_auto_rejection_emails(*, now=None, batch_size=200):
    """Notify candidates only after the three-day undo window has elapsed."""
    now = now or timezone.now()
    applications = list(
        Application.objects.filter(
            status=Application.Status.REJECTED,
            auto_rejected_at__lte=now - AUTO_REJECTION_EMAIL_GRACE,
            auto_rejection_email_sent_at__isnull=True,
            job__auto_reject_stale_applications=True,
        )
        .select_related('candidate', 'job', 'job__company')
        .order_by('auto_rejected_at', 'pk')[:batch_size]
    )
    sent = 0
    for application in applications:
        body = _render_candidate_body(application)
        recipient = application.contact_email or application.candidate.email
        send_html_email(
            subject=f'Kết quả ứng tuyển vị trí {application.job.title}',
            text=body,
            html=_email_html(body),
            to=recipient,
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
