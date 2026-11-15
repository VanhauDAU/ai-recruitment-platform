"""Tell the recruiter a new application arrived: bell notice + email.

The email names the job, not the candidate: personal data stays behind the
workspace, where candidate-data access is checked on every read.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string

from apps.accounts.services import is_account_accessible
from apps.candidates.services import email_brand_context
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event, new_application_email_enabled
from apps.jobs.models import JobApplicationContact
from apps.sitecontent.selectors import get_bool_setting
from common.email import send_html_email

from ..models import Application

logger = logging.getLogger(__name__)
EMPLOYER_SETTINGS_PATH = '/tuyendung/app/notifications'


def _workspace_path(application):
    return (
        f'/tuyendung/app/applications?job={application.job.public_id}'
        f'&application={application.public_id}'
    )


def alert_recruiter_of_withdrawal(application):
    """Tell the posting recruiter, in the bell only, that a candidate withdrew."""
    recruiter = application.job.posted_by
    if recruiter is None:
        return
    emit_employer_event(
        recipient=recruiter,
        event_type=EmployerNotification.EventType.APPLICATION_WITHDRAWN,
        dedupe_key=f'application-withdrawn:{application.public_id}',
        message=f'Một ứng viên đã rút hồ sơ khỏi vị trí {application.job.title}.',
        subject_public_id=application.public_id,
        metadata={'application_public_id': application.public_id},
        action_path=_workspace_path(application),
    )


def alert_recruiter_of_application(application):
    """Run inside the application's transaction; the email waits for commit."""
    recruiter = application.job.posted_by
    if recruiter is None:
        return
    emit_employer_event(
        recipient=recruiter,
        event_type=EmployerNotification.EventType.APPLICATION_RECEIVED,
        dedupe_key=f'application-received:{application.public_id}',
        message=f'Có hồ sơ mới cho vị trí {application.job.title}.',
        subject_public_id=application.public_id,
        metadata={'application_public_id': application.public_id},
        action_path=_workspace_path(application),
    )
    application_id = application.pk

    def enqueue():
        # Imported here: tasks depend on services, not the other way round.
        from ..tasks import send_new_application_email

        try:
            send_new_application_email.delay(application_id)
        except Exception:  # noqa: BLE001 - the bell notice already exists
            logger.exception('Unable to enqueue new-application email %s.', application_id)

    transaction.on_commit(enqueue)


def _recipients(job):
    try:
        emails = [item.email for item in job.application_contact.emails.all()]
    except JobApplicationContact.DoesNotExist:
        emails = []
    return list(dict.fromkeys(emails or [job.posted_by.email]))


def send_new_application_email(application_id):
    """Email the job's application contacts; returns how many were sent."""
    application = (
        Application.objects.select_related('job__posted_by', 'job__company')
        .filter(pk=application_id)
        .first()
    )
    if application is None or application.job.posted_by is None:
        return 0
    job = application.job
    recruiter = job.posted_by
    if not (
        is_account_accessible(recruiter)
        and get_bool_setting('email_notifications_enabled', True)
        and get_bool_setting('email_notify_new_application', True)
        and new_application_email_enabled(recruiter)
    ):
        return 0
    brand = email_brand_context()
    base = settings.EMPLOYER_FRONTEND_URL.rstrip('/')
    context = {
        'brand': brand,
        'site_name': brand['site_name'],
        'title': f'Có hồ sơ ứng tuyển mới cho vị trí {job.title}',
        'job_title': job.title,
        'company_name': job.company.company_name,
        'applied_at': application.applied_at,
        'application_count': job.application_count,
        'action_url': f'{base}{_workspace_path(application)}',
        'home_url': f'{base}/tuyendung/app/dashboard',
        'header_cta_url': f'{base}/tuyendung/app/applications',
        'header_cta_label': 'Quản lý CV',
        'email_settings_url': f'{base}{EMPLOYER_SETTINGS_PATH}',
    }
    sender = settings.EMAIL_FROM_ADDRESS
    from_email = f'{brand["from_name"]} <{sender}>' if brand['from_name'] else sender
    text = render_to_string('applications/email/new_application.txt', context)
    html = render_to_string('applications/email/new_application.html', context)
    recipients = _recipients(job)
    for recipient in recipients:
        send_html_email(
            subject=f'{context["title"]} · {brand["site_name"]}',
            text=text,
            html=html,
            to=recipient,
            from_email=from_email,
            reply_to=brand['support_email'] or None,
        )
    return len(recipients)
