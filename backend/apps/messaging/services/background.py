"""Việc nền của ProCV Connect: email nhắc tin chưa đọc, nhắc lịch phỏng vấn."""

from datetime import timedelta

from django.db.models import F
from django.utils import timezone

from ..domain import Role
from ..models import Conversation, InterviewAppointment
from .notifications import notify_interview_reminder, send_unread_digest
from .policy import unread_email_delay
from .realtime import recruiter_may_receive

BATCH = 200


def send_unread_message_emails(now=None):
    """Mỗi đợt chưa đọc chỉ email một lần: đọc xong mới được nhắc lại."""
    delay = unread_email_delay()
    if delay is None:
        return 0
    cutoff = (now or timezone.now()) - delay
    sent = 0
    for role, prefix in ((Role.CANDIDATE, 'candidate'), (Role.RECRUITER, 'recruiter')):
        rows = (
            Conversation.objects.select_related('job__posted_by', 'company', 'candidate')
            .filter(
                **{
                    f'{prefix}_unread__gt': 0,
                    f'{prefix}_emailed_seq__lte': F(f'{prefix}_last_read_seq'),
                    'last_message_at__lte': cutoff,
                }
            )
            .order_by('last_message_at')[:BATCH]
        )
        for conversation in rows:
            user = conversation.candidate if role == Role.CANDIDATE else conversation.job.posted_by
            # Ghi mốc trước khi gửi: lỗi SMTP không làm email lặp mỗi 5 phút.
            Conversation.objects.filter(pk=conversation.pk).update(
                **{f'{prefix}_emailed_seq': conversation.last_seq}
            )
            if role == Role.RECRUITER and not recruiter_may_receive(user):
                continue
            if send_unread_digest(conversation, role, user, conversation.unread(role)):
                sent += 1
    return sent


def send_interview_reminders(now=None):
    """Nhắc hai bên trước 24 giờ và 1 giờ; lịch đặt sát giờ chỉ nhận lần nhắc 1 giờ."""
    now = now or timezone.now()
    accepted = InterviewAppointment.objects.select_related(
        'conversation__job__posted_by',
        'conversation__company',
        'conversation__candidate',
        'application',
    ).filter(status=InterviewAppointment.Status.ACCEPTED, starts_at__gt=now)
    sent = 0
    for interview in accepted.filter(
        starts_at__lte=now + timedelta(hours=1), reminded_1h_at__isnull=True
    ):
        notify_interview_reminder(interview, hours=1)
        InterviewAppointment.objects.filter(pk=interview.pk).update(
            reminded_1h_at=now, reminded_24h_at=now
        )
        sent += 1
    for interview in accepted.filter(
        starts_at__lte=now + timedelta(hours=24), reminded_24h_at__isnull=True
    ):
        notify_interview_reminder(interview, hours=24)
        InterviewAppointment.objects.filter(pk=interview.pk).update(reminded_24h_at=now)
        sent += 1
    return sent
