"""Lịch hẹn phỏng vấn trong hội thoại: NTD đề xuất, ứng viên phản hồi, hai bên được nhắc."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound, ValidationError

from apps.applications.models import Application
from apps.applications.services import (
    InvalidApplicationStatusTransition,
    change_application_status,
    record_interview_end,
)
from apps.employers.services import ensure_recruiter_candidate_data_access

from ..domain import Role, SystemEvent
from ..models import InterviewAppointment, Message
from .messages import append_message, ensure_can_send, lock_conversation
from .notifications import (
    conversation_path,
    notify_candidate_interview,
    notify_recruiter_interview,
)
from .realtime import push_message

Status = InterviewAppointment.Status
MIN_LEAD = timedelta(minutes=5)
RESPONSES = {
    'accept': (Status.ACCEPTED, SystemEvent.INTERVIEW_ACCEPTED),
    'decline': (Status.DECLINED, SystemEvent.INTERVIEW_DECLINED),
    'reschedule': (Status.RESCHEDULE_REQUESTED, SystemEvent.INTERVIEW_RESCHEDULE_REQUESTED),
}


def _ended(interview):
    return timezone.now() >= interview.starts_at + timedelta(minutes=interview.duration_minutes)


def _push_cards(conversation, interviews):
    for message in Message.objects.select_related('interview__application').filter(
        interview__in=interviews, kind=Message.Kind.INTERVIEW
    ):
        push_message(conversation, message, updated=True)


def _system(conversation, event, actor_role, interview):
    append_message(
        conversation,
        sender=None,
        role=Role.SYSTEM,
        kind=Message.Kind.SYSTEM,
        payload={'event': event, 'actor_role': str(actor_role), 'interview': interview.public_id},
        reader_role=actor_role,
    )


def _invite(application, recruiter, conversation):
    """Gửi lịch là mời phỏng vấn: hồ sơ chưa ở "Phỏng vấn" thì chuyển qua đúng luồng
    quyết định (lịch sử, hoạt động) và báo ứng viên ngay — một thông báo trỏ vào hội thoại.
    Trả True khi vừa chuyển trạng thái."""
    if application.status == Application.Status.INTERVIEWED:
        return False
    try:
        change_application_status(
            application,
            changed_by=recruiter,
            status=Application.Status.INTERVIEWED,
            notify_now=True,
            action_path=conversation_path(conversation, Role.CANDIDATE),
        )
    except InvalidApplicationStatusTransition as error:
        raise ValidationError({'detail': str(error)}) from error
    return True


@transaction.atomic
def propose_interview(recruiter, public_id, data):
    ensure_recruiter_candidate_data_access(recruiter)
    conversation = lock_conversation(recruiter, Role.RECRUITER, public_id)
    application = ensure_can_send(conversation, Role.RECRUITER)
    if application is None or application.status in Application.TERMINAL_STATUSES:
        raise ValidationError({'detail': _('Chỉ hẹn phỏng vấn với hồ sơ đang xét tuyển.')})
    if data['starts_at'] < timezone.now() + MIN_LEAD:
        raise ValidationError({'starts_at': _('Giờ hẹn phải ở tương lai.')})
    if data['mode'] == InterviewAppointment.Mode.ONLINE and not data.get('meeting_url'):
        raise ValidationError({'meeting_url': _('Hãy nhập link họp trực tuyến.')})
    if data['mode'] == InterviewAppointment.Mode.ONSITE and not data.get('location'):
        raise ValidationError({'location': _('Hãy nhập địa điểm phỏng vấn.')})
    invited = _invite(application, recruiter, conversation)
    # Lịch mới thay lịch đang chờ/xin đổi giờ, và cả lịch đã nhận chưa diễn ra (đổi giờ).
    replaced = [
        item
        for item in InterviewAppointment.objects.select_for_update().filter(
            application=application,
            status__in=(*InterviewAppointment.OPEN_STATUSES, Status.ACCEPTED),
        )
        if item.status != Status.ACCEPTED or not _ended(item)
    ]
    if any(item.status == Status.ACCEPTED for item in replaced):
        record_interview_end(application.pk, None)
    InterviewAppointment.objects.filter(pk__in=[item.pk for item in replaced]).update(
        status=Status.SUPERSEDED, updated_at=timezone.now()
    )
    interview = InterviewAppointment.objects.create(
        conversation=conversation,
        application=application,
        proposed_by=recruiter,
        starts_at=data['starts_at'],
        duration_minutes=data['duration_minutes'],
        mode=data['mode'],
        location=data.get('location', ''),
        meeting_url=data.get('meeting_url', ''),
        note=data.get('note', ''),
    )
    message = append_message(
        conversation,
        sender=recruiter,
        role=Role.RECRUITER,
        kind=Message.Kind.INTERVIEW,
        interview=interview,
    )
    if replaced:
        _push_cards(conversation, replaced)
    if not invited:
        # Đã ở "Phỏng vấn" (lịch mới, đổi giờ): báo riêng về lịch hẹn.
        notify_candidate_interview(conversation, interview, scheduled=True)
    return message


def _locked_interview(public_id, **owner):
    interview = (
        InterviewAppointment.objects.select_for_update(of=('self',))
        .select_related('conversation')
        .filter(public_id=public_id, **owner)
        .first()
    )
    if interview is None:
        raise NotFound
    return interview


@transaction.atomic
def respond_to_interview(candidate, public_id, action, note=''):
    interview = _locked_interview(public_id, conversation__candidate=candidate)
    if action not in RESPONSES:
        raise ValidationError({'action': _('Phản hồi không hợp lệ.')})
    if interview.status != Status.PROPOSED or interview.starts_at <= timezone.now():
        raise ValidationError({'detail': _('Lịch hẹn này không còn chờ phản hồi.')})
    conversation = lock_conversation(candidate, Role.CANDIDATE, interview.conversation.public_id)
    ensure_can_send(conversation, Role.CANDIDATE)
    status, event = RESPONSES[action]
    interview.status = status
    interview.candidate_note = str(note or '').strip()[:1000]
    interview.responded_at = timezone.now()
    interview.save(update_fields=['status', 'candidate_note', 'responded_at', 'updated_at'])
    if status == Status.ACCEPTED:
        record_interview_end(
            interview.application_id,
            interview.starts_at + timedelta(minutes=interview.duration_minutes),
        )
    _push_cards(conversation, [interview])
    _system(conversation, event, Role.CANDIDATE, interview)
    notify_recruiter_interview(conversation, interview, action)
    return interview


def _recruiter_interview(recruiter, public_id):
    interview = _locked_interview(public_id, conversation__job__posted_by=recruiter)
    conversation = lock_conversation(recruiter, Role.RECRUITER, interview.conversation.public_id)
    return interview, conversation


@transaction.atomic
def cancel_interview(recruiter, public_id, note=''):
    interview, conversation = _recruiter_interview(recruiter, public_id)
    if interview.status not in (*InterviewAppointment.OPEN_STATUSES, Status.ACCEPTED):
        raise ValidationError({'detail': _('Lịch hẹn này không thể hủy.')})
    if interview.status == Status.ACCEPTED:
        record_interview_end(interview.application_id, None)
    interview.status = Status.CANCELLED
    if note:
        interview.note = f'{interview.note}\n{str(note).strip()[:1000]}'.strip()
    interview.save(update_fields=['status', 'note', 'updated_at'])
    _push_cards(conversation, [interview])
    _system(conversation, SystemEvent.INTERVIEW_CANCELLED, Role.RECRUITER, interview)
    notify_candidate_interview(conversation, interview, scheduled=False)
    return interview
