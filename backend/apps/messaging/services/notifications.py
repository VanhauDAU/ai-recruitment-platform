"""Chuông và email của ProCV Connect.

Email không bao giờ chứa nội dung tin nhắn (ADR-0032, quyết định 8): chỉ số tin
mới, tên công ty và vị trí, kèm liên kết mở hội thoại trong sản phẩm.
"""

import logging
from datetime import UTC, timedelta

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.services import is_account_accessible
from apps.candidates.models import CandidateNotification
from apps.candidates.services import email_brand_context, emit_candidate_notification
from apps.employers.models import EmployerNotification
from apps.employers.selectors import email_sender_company_name
from apps.employers.services import emit_employer_event
from apps.sitecontent.selectors import business_emails_enabled, email_sender
from common.email import send_html_email
from common.i18n import recipient_language
from common.portal_paths import employer_app_path

from ..domain import Role

logger = logging.getLogger(__name__)

CANDIDATE_CONNECT_PATH = '/procv-connect'
EMPLOYER_CONNECT_PATH = employer_app_path('/procv-connect')


def conversation_path(conversation, role):
    base = CANDIDATE_CONNECT_PATH if role == Role.CANDIDATE else EMPLOYER_CONNECT_PATH
    return f'{base}/{conversation.public_id}'


def conversation_url(conversation, role):
    origin = settings.FRONTEND_URL if role == Role.CANDIDATE else settings.EMPLOYER_FRONTEND_URL
    return f'{origin.rstrip("/")}{conversation_path(conversation, role)}'


def _context(conversation):
    return {
        'company_name': conversation.company.company_name,
        'job_title': conversation.job.title,
    }


def notify_candidate_interview(conversation, interview, *, scheduled):
    event = (
        CandidateNotification.EventType.INTERVIEW_SCHEDULED
        if scheduled
        else CandidateNotification.EventType.INTERVIEW_UPDATED
    )
    emit_candidate_notification(
        recipient=conversation.candidate,
        event_type=event,
        dedupe_key=f'{event}:{interview.public_id}:{interview.status}',
        context=_context(conversation),
        metadata={
            'application_public_id': interview.application.public_id,
            'company_public_id': conversation.company.public_id,
        },
        action_path=conversation_path(conversation, Role.CANDIDATE),
    )


def notify_recruiter_interview(conversation, interview, action):
    recruiter = conversation.job.posted_by
    with recipient_language(recruiter):
        message = {
            'accept': _('Ứng viên đã nhận lịch phỏng vấn vị trí %(job)s.'),
            'decline': _('Ứng viên đã từ chối lịch phỏng vấn vị trí %(job)s.'),
            'reschedule': _('Ứng viên đề nghị đổi giờ phỏng vấn vị trí %(job)s.'),
        }[action] % {'job': conversation.job.title}
        emit_employer_event(
            recipient=recruiter,
            event_type=EmployerNotification.EventType.INTERVIEW_RESPONDED,
            dedupe_key=f'interview-{action}:{interview.public_id}:{interview.responded_at:%s}',
            message=message,
            subject_public_id=interview.public_id,
            metadata={'application_public_id': interview.application.public_id},
            action_path=conversation_path(conversation, Role.RECRUITER),
        )
    if action == 'accept':
        interview_id = interview.pk

        def enqueue():
            from ..tasks import send_interview_calendar

            try:
                send_interview_calendar.delay(interview_id)
            except Exception:  # noqa: BLE001 - lịch vẫn hiện trong ProCV Connect
                logger.exception('Unable to enqueue interview calendar %s.', interview_id)

        transaction.on_commit(enqueue)


def notify_interview_reminder(interview, *, hours):
    conversation = interview.conversation
    emit_candidate_notification(
        recipient=conversation.candidate,
        event_type=CandidateNotification.EventType.INTERVIEW_REMINDER,
        dedupe_key=f'interview-reminder-{hours}h:{interview.public_id}',
        context=_context(conversation),
        metadata={
            'application_public_id': interview.application.public_id,
            'company_public_id': conversation.company.public_id,
        },
        action_path=conversation_path(conversation, Role.CANDIDATE),
    )
    recruiter = conversation.job.posted_by
    with recipient_language(recruiter):
        emit_employer_event(
            recipient=recruiter,
            event_type=EmployerNotification.EventType.INTERVIEW_REMINDER,
            dedupe_key=f'interview-reminder-{hours}h:{interview.public_id}',
            message=_('Sắp đến giờ phỏng vấn vị trí %(job)s (%(time)s).')
            % {
                'job': conversation.job.title,
                'time': timezone.localtime(interview.starts_at).strftime('%H:%M %d/%m/%Y'),
            },
            subject_public_id=interview.public_id,
            metadata={'application_public_id': interview.application.public_id},
            action_path=conversation_path(conversation, Role.RECRUITER),
        )


def _ics(interview):
    def stamp(value):
        return value.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')

    conversation = interview.conversation
    end = interview.starts_at + timedelta(minutes=interview.duration_minutes)
    where = interview.meeting_url or interview.location

    def escape(text):
        return (
            str(text)
            .replace('\\', '\\\\')
            .replace(';', '\;')
            .replace(',', '\\,')
            .replace('\n', '\\n')
        )

    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ProCV//ProCV Connect//VI',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        f'UID:{interview.public_id}@procv',
        f'DTSTAMP:{stamp(timezone.now())}',
        f'DTSTART:{stamp(interview.starts_at)}',
        f'DTEND:{stamp(end)}',
        f'SUMMARY:{escape(_("Phỏng vấn %(job)s") % {"job": conversation.job.title})}',
        f'LOCATION:{escape(where)}',
        f'DESCRIPTION:{escape(interview.note)}',
        'END:VEVENT',
        'END:VCALENDAR',
    ]
    return '\r\n'.join(lines) + '\r\n'


def _send(recipient, subject, template, context, attachment=None, on_behalf_of=''):
    """``on_behalf_of``: tên công ty khi gửi ứng viên thay mặt nhà tuyển dụng."""
    with recipient_language(recipient):
        brand = email_brand_context()
        context = {**context, 'brand': brand, 'site_name': brand['site_name'], 'title': subject}
        text = render_to_string(f'messaging/email/{template}.txt', context)
        html = render_to_string(f'messaging/email/{template}.html', context)
        send_html_email(
            subject=f'{subject} · {brand["site_name"]}',
            text=text,
            html=html,
            to=recipient.email,
            attachments=[attachment] if attachment else None,
            **email_sender(on_behalf_of),
        )


def _candidate_sender(conversation, role):
    """Email gửi ứng viên đứng tên công ty; gửi nhà tuyển dụng vẫn là ProCV."""
    if role != Role.CANDIDATE:
        return ''
    return email_sender_company_name(conversation.company.public_id)


def send_interview_calendar(interview):
    """Email kèm tệp .ics cho hai bên khi ứng viên nhận lịch; trả số email đã gửi."""
    if not business_emails_enabled():
        return 0
    conversation = interview.conversation
    sent = 0
    ics = ('phong-van.ics', _ics(interview), 'text/calendar')
    for role, user in (
        (Role.CANDIDATE, conversation.candidate),
        (Role.RECRUITER, conversation.job.posted_by),
    ):
        if not is_account_accessible(user) or not user.email:
            continue
        with recipient_language(user):
            subject = _('Lịch phỏng vấn vị trí %(job)s') % {'job': conversation.job.title}
        _send(
            user,
            subject,
            'interview_accepted',
            {
                **_context(conversation),
                'starts_at_text': timezone.localtime(interview.starts_at).strftime(
                    '%H:%M %d/%m/%Y'
                ),
                'duration_minutes': interview.duration_minutes,
                'where': interview.meeting_url or interview.location,
                'action_url': conversation_url(conversation, role),
            },
            attachment=ics,
            on_behalf_of=_candidate_sender(conversation, role),
        )
        sent += 1
    return sent


def send_unread_digest(conversation, role, user, unread):
    if not (business_emails_enabled() and is_account_accessible(user) and user.email):
        return False
    with recipient_language(user):
        sender = (
            conversation.company.company_name
            if role == Role.CANDIDATE
            else (conversation.candidate.full_name or _('Ứng viên'))
        )
        subject = _('Bạn có %(count)s tin nhắn mới từ %(sender)s') % {
            'count': unread,
            'sender': sender,
        }
    _send(
        user,
        subject,
        'unread_messages',
        {
            **_context(conversation),
            'sender_name': sender,
            'unread': unread,
            'action_url': conversation_url(conversation, role),
        },
        on_behalf_of=_candidate_sender(conversation, role),
    )
    return True
