"""Render candidate notice emails: subject, plain text and HTML."""

from django.conf import settings
from django.template.loader import render_to_string

from apps.sitecontent.selectors import email_branding

from .notification_events import EVENTS, render_text, switch_enabled

APPLIED_JOBS_PATH = '/tai-khoan/viec-lam-da-ung-tuyen'
EMAIL_SETTINGS_PATH = '/tai-khoan/cai-dat-nhan-email'
MY_CVS_PATH = '/tai-khoan/cv-cua-toi'
JOBS_PATH = '/viec-lam'
SIMILAR_JOBS_LIMIT = 5
# Outlook and older clients cannot render WebP/SVG logos; fall back to text.
EMAIL_SAFE_IMAGE = ('.png', '.jpg', '.jpeg', '.gif')


def _frontend(path):
    return f'{settings.FRONTEND_URL.rstrip("/")}{path}'


def _application_received_context(notification):
    # Imported here: apps.jobs imports this app's models at module level.
    from apps.jobs.models import Job
    from apps.jobs.selectors import similar_jobs_for_job
    from apps.jobs.services import job_email_card

    job = (
        Job.objects.select_related('company')
        .prefetch_related('job_locations__location__parent')
        .filter(public_id=notification.metadata.get('job_public_id'))
        .first()
    )
    if job is None:
        return {}
    similar_jobs = []
    if switch_enabled(notification.recipient_id, 'similar_jobs_in_application_email'):
        # Computed at send time (Celery), so the list is fresh and applying
        # stays fast.
        similar_jobs = [
            job_email_card(item)
            for item in similar_jobs_for_job(notification.recipient, job, limit=SIMILAR_JOBS_LIMIT)
        ]
    return {
        'job': job_email_card(job),
        'similar_jobs': similar_jobs,
        'subject_context': {'job_title': job.title, 'company_name': job.company.company_name},
    }


EVENT_CONTEXT = {'application_received': _application_received_context}


def _branding():
    from apps.jobs.services import absolute_url

    branding = email_branding()
    logo = branding.pop('logo_path')
    branding['logo_url'] = absolute_url(logo) if logo.lower().endswith(EMAIL_SAFE_IMAGE) else ''
    return branding


def render_notification_email(notification):
    """Return ``(subject, text, html, from_email, reply_to)`` for one notice."""
    spec = EVENTS[notification.event_type]
    branding = _branding()
    extra = EVENT_CONTEXT.get(spec.email_template, lambda _notification: {})(notification)
    subject = notification.title
    if spec.email_subject and extra.get('subject_context'):
        subject = render_text(spec.email_subject, extra['subject_context'])
    context = {
        'brand': branding,
        'site_name': branding['site_name'],
        'candidate_name': notification.recipient.full_name or notification.recipient.email,
        'title': notification.title,
        'message': notification.message,
        'action_url': _frontend(notification.action_path or APPLIED_JOBS_PATH),
        'applied_jobs_url': _frontend(APPLIED_JOBS_PATH),
        'jobs_url': _frontend(JOBS_PATH),
        'my_cvs_url': _frontend(MY_CVS_PATH),
        'home_url': _frontend('/'),
        'email_settings_url': _frontend(EMAIL_SETTINGS_PATH),
        **extra,
    }
    template = f'candidates/email/{spec.email_template}'
    sender = settings.EMAIL_FROM_ADDRESS
    return (
        f'{subject} · {branding["site_name"]}',
        render_to_string(f'{template}.txt', context),
        render_to_string(f'{template}.html', context),
        f'{branding["from_name"]} <{sender}>' if branding['from_name'] else sender,
        branding['support_email'] or None,
    )
