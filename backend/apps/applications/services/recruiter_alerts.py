"""Tell the recruiter a new application arrived: bell notice + email.

The email names the job, not the candidate: personal data stays behind the
workspace, where candidate-data access is checked on every read.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.services import is_account_accessible
from apps.candidates.services import email_brand_context
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event, new_application_email_enabled
from apps.jobs.models import Job, JobApplicationContact
from apps.sitecontent.selectors import business_emails_enabled, email_sender, get_bool_setting
from common.email import send_html_email
from common.i18n import recipient_language

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
    with recipient_language(recruiter):
        emit_employer_event(
            recipient=recruiter,
            event_type=EmployerNotification.EventType.APPLICATION_WITHDRAWN,
            dedupe_key=f'application-withdrawn:{application.public_id}',
            message=_('Một ứng viên đã rút hồ sơ khỏi vị trí %(job)s.')
            % {'job': application.job.title},
            subject_public_id=application.public_id,
            metadata={'application_public_id': application.public_id},
            action_path=_workspace_path(application),
        )


def alert_recruiter_of_application(application):
    """Run inside the application's transaction; the email waits for commit."""
    recruiter = application.job.posted_by
    if recruiter is None:
        return
    with recipient_language(recruiter):
        emit_employer_event(
            recipient=recruiter,
            event_type=EmployerNotification.EventType.APPLICATION_RECEIVED,
            dedupe_key=f'application-received:{application.public_id}',
            message=_('Có hồ sơ mới cho vị trí %(job)s.') % {'job': application.job.title},
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
        and business_emails_enabled()
        and get_bool_setting('email_notify_new_application', True)
        and new_application_email_enabled(recruiter)
    ):
        return 0
    with recipient_language(recruiter):
        return _send_new_application_email(application)


def _send_new_application_email(application):
    job = application.job
    brand = email_brand_context()
    base = settings.EMPLOYER_FRONTEND_URL.rstrip('/')
    context = {
        'brand': brand,
        'site_name': brand['site_name'],
        'title': _('Có hồ sơ ứng tuyển mới cho vị trí %(job)s') % {'job': job.title},
        'job_title': job.title,
        'company_name': job.company.company_name,
        'applied_at': application.applied_at,
        'applied_at_text': timezone.localtime(application.applied_at).strftime('%H:%M %d/%m/%Y'),
        'application_count': job.application_count,
        'action_url': f'{base}{_workspace_path(application)}',
        'home_url': f'{base}/tuyendung/app/dashboard',
        'header_cta_url': f'{base}/tuyendung/app/applications',
        'header_cta_label': _('Quản lý CV'),
        'email_settings_url': f'{base}{EMPLOYER_SETTINGS_PATH}',
    }
    text = render_to_string('applications/email/new_application.txt', context)
    html = render_to_string('applications/email/new_application.html', context)
    recipients = _recipients(job)
    for recipient in recipients:
        send_html_email(
            subject=f'{context["title"]} · {brand["site_name"]}',
            text=text,
            html=html,
            to=recipient,
            **email_sender(),
        )
    return len(recipients)


def send_interview_decision_email(job_id, application_ids):
    """Email nhắc NTD ra kết quả phỏng vấn; chỉ tên vị trí và số ứng viên, không dữ liệu cá nhân."""
    # Import muộn: reminders → applications → recruiter_alerts tạo vòng lúc nạp module.
    from .reminders import reminder_recipients

    job = Job.objects.select_related('company', 'posted_by').filter(pk=job_id).first()
    if job is None or not (business_emails_enabled() and application_ids):
        return 0
    count = Application.objects.filter(
        pk__in=application_ids, job=job, status=Application.Status.INTERVIEWED, is_current=True
    ).count()
    if not count:
        return 0
    base = settings.EMPLOYER_FRONTEND_URL.rstrip('/')
    sent = 0
    for recipient in reminder_recipients(job):
        if not (is_account_accessible(recipient) and recipient.email):
            continue
        with recipient_language(recipient):
            brand = email_brand_context()
            context = {
                'brand': brand,
                'site_name': brand['site_name'],
                'title': _('Ứng viên đang chờ kết quả phỏng vấn vị trí %(job)s')
                % {'job': job.title},
                'job_title': job.title,
                'company_name': job.company.company_name,
                'count': count,
                'action_url': f'{base}/tuyendung/app/applications?job={job.public_id}',
                'email_settings_url': f'{base}{EMPLOYER_SETTINGS_PATH}',
            }
            send_html_email(
                subject=f'{context["title"]} · {brand["site_name"]}',
                text=render_to_string('applications/email/interview_result_pending.txt', context),
                html=render_to_string('applications/email/interview_result_pending.html', context),
                to=recipient.email,
                **email_sender(),
            )
        sent += 1
    return sent
