"""Gửi tin nhắn: cấp ``seq`` dưới khóa hàng, idempotent theo ``client_id``."""

import re

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.applications.models import Application
from apps.cvs.models import UserCv
from apps.cvs.services import create_application_snapshot, is_unsaved_builder_baseline
from apps.jobs.models import Job

from ..domain import MAX_BODY_CHARS, LockedReason, Role, message_preview
from ..models import Conversation, Message
from .access import candidate_limit_remaining, lock_reason
from .presenters import job_snapshot
from .realtime import push_message

# Ký tự điều khiển (trừ xuống dòng, tab) không có nghĩa trong tin chữ.
_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

LOCK_MESSAGES = {
    LockedReason.UNAVAILABLE: gettext_lazy('Cuộc trò chuyện hiện không nhận tin nhắn.'),
    LockedReason.BLOCKED: gettext_lazy('Ứng viên này đang bị công ty chặn.'),
    LockedReason.WITHDRAWN: gettext_lazy('Hồ sơ ứng tuyển đã được rút nên không gửi được tin.'),
    LockedReason.BLOCKED_BY_ME: gettext_lazy('Bạn đã chặn tin nhắn trong cuộc trò chuyện này.'),
    LockedReason.ACCOUNT: gettext_lazy('Tài khoản bên kia không còn hoạt động.'),
    LockedReason.DISABLED: gettext_lazy('ProCV Connect đang tạm tắt.'),
}


def clean_body(body):
    text = _CONTROL_CHARS.sub('', str(body or '')).strip()
    if not text:
        raise ValidationError({'body': _('Hãy nhập nội dung tin nhắn.')})
    if len(text) > MAX_BODY_CHARS:
        raise ValidationError(
            {'body': _('Tin nhắn tối đa %(max)s ký tự.') % {'max': MAX_BODY_CHARS}}
        )
    return text


def append_message(
    conversation,
    *,
    sender,
    role,
    kind,
    body='',
    payload=None,
    reader_role=None,
    push=True,
    activity=True,
    **fields,
):
    """Ghi một tin vào hội thoại đã ``select_for_update``; cập nhật seq, xem trước, chưa đọc.

    ``reader_role`` là phía coi như đã đọc tin này (người gửi; với tin hệ thống là
    người gây ra sự kiện). Phía còn lại tăng số chưa đọc. ``activity=False`` (tin hệ
    thống "bắt đầu trò chuyện"): chỉ ghi vào luồng, không đưa hội thoại lên danh sách,
    không tính chưa đọc — hội thoại chỉ hiện khi có tin thật đầu tiên.
    """
    reader_role = reader_role or role
    now = timezone.now()
    conversation.last_seq += 1
    message = Message.objects.create(
        conversation=conversation,
        seq=conversation.last_seq,
        sender=sender,
        sender_role=str(role),
        kind=kind,
        body=body,
        payload=payload or {},
        **fields,
    )
    if not activity:
        conversation.save(update_fields=['last_seq'])
        if push:
            push_message(conversation, message)
        return message
    conversation.last_message_at = now
    conversation.last_message_preview = message_preview(body) if kind == Message.Kind.TEXT else ''
    conversation.last_message_kind = kind
    conversation.last_sender_role = str(role)
    for side in (Role.CANDIDATE, Role.RECRUITER):
        prefix = 'candidate' if side == Role.CANDIDATE else 'recruiter'
        if side == reader_role:
            setattr(conversation, f'{prefix}_last_read_seq', conversation.last_seq)
            setattr(conversation, f'{prefix}_unread', 0)
        else:
            setattr(conversation, f'{prefix}_unread', getattr(conversation, f'{prefix}_unread') + 1)
    if role == Role.RECRUITER and conversation.recruiter_replied_at is None:
        conversation.recruiter_replied_at = now
    conversation.save()
    if push:
        push_message(conversation, message)
    return message


def lock_conversation(user, role, public_id):
    """Hội thoại của người gọi, khóa hàng để cấp seq tuần tự."""
    owned = {'candidate': user} if role == Role.CANDIDATE else {'job__posted_by': user}
    conversation = (
        Conversation.objects.select_for_update(of=('self',))
        .select_related('job__posted_by', 'job__company', 'candidate')
        .filter(public_id=public_id, **owned)
        .first()
    )
    if conversation is None:
        raise NotFound
    return conversation


def ensure_can_send(conversation, role):
    application = Application.objects.filter(
        job_id=conversation.job_id, candidate_id=conversation.candidate_id, is_current=True
    ).first()
    reason = lock_reason(conversation, role, application=application)
    if reason:
        raise PermissionDenied(LOCK_MESSAGES[reason])
    if candidate_limit_remaining(conversation, role) == 0:
        raise PermissionDenied(_('Bạn đã gửi đủ số tin cho phép. Hãy chờ nhà tuyển dụng trả lời.'))
    return application


def _existing(user, client_id):
    if client_id is None:
        return None
    return (
        Message.objects.select_related('interview__application', 'cv_version')
        .filter(sender=user, client_id=client_id)
        .first()
    )


def _job_fields(user, role, job_public_id):
    if role != Role.RECRUITER:
        raise PermissionDenied
    job = (
        Job.publicly_available_queryset()
        .filter(public_id=job_public_id, company__recruiters__user=user)
        .select_related('company')
        .prefetch_related('job_locations__location__parent')
        .first()
    )
    if job is None:
        raise ValidationError({'job': _('Chỉ gửi được tin đang tuyển của công ty bạn.')})
    return {'payload': {'job': job_snapshot(job)}, 'shared_job': job}


def _cv_fields(user, role, cv_public_id):
    if role != Role.CANDIDATE:
        raise PermissionDenied
    cv = (
        UserCv.objects.select_related('latest_version')
        .filter(public_id=cv_public_id, user=user, is_deleted=False)
        .first()
    )
    if (
        cv is None
        or cv.latest_version is None
        or is_unsaved_builder_baseline(cv, cv.latest_version)
    ):
        raise ValidationError({'cv': _('Hãy chọn một CV đã lưu của bạn.')})
    version = create_application_snapshot(cv, user)
    return {
        'payload': {'cv_title': cv.title, 'cv_type': cv.cv_type},
        'cv_version': version,
    }


@transaction.atomic
def send_message(
    user, role, public_id, *, client_id=None, kind, body='', job='', cv='', file_fields=None
):
    """Gửi một tin; trả ``(message, created)``. Gửi lại cùng ``client_id`` trả tin cũ."""
    existing = _existing(user, client_id)
    if existing is not None:
        return existing, False
    conversation = lock_conversation(user, role, public_id)
    existing = _existing(user, client_id)  # hai request trùng chờ cùng một khóa
    if existing is not None:
        return existing, False
    ensure_can_send(conversation, role)
    fields = {}
    text = ''
    if kind == Message.Kind.TEXT:
        text = clean_body(body)
    elif kind == Message.Kind.JOB:
        fields = _job_fields(user, role, job)
    elif kind == Message.Kind.CV:
        fields = _cv_fields(user, role, cv)
    elif kind in (Message.Kind.FILE, Message.Kind.IMAGE) and file_fields:
        fields = dict(file_fields)
    else:
        raise ValidationError({'kind': _('Loại tin nhắn không hợp lệ.')})
    message = append_message(
        conversation, sender=user, role=role, kind=kind, body=text, client_id=client_id, **fields
    )
    return message, True
