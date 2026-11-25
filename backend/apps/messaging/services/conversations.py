"""Mở hội thoại, quyền gửi và đánh dấu đã đọc."""

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.services import is_account_accessible
from apps.applications.models import Application, CandidateSearchInvitation
from apps.applications.services import is_candidate_blocked
from apps.employers.services import ensure_recruiter_candidate_data_access
from apps.jobs.models import Job

from ..domain import Role, SystemEvent
from ..models import Conversation, Message
from .access import NOT_ALLOWED
from .messages import append_message
from .policy import connect_enabled
from .realtime import push_conversation_changed, push_read


def _current_application(job, candidate):
    return Application.objects.filter(job=job, candidate=candidate, is_current=True).first()


def _get_or_create(job, candidate, origin, opened_by_role):
    """Một hội thoại cho mỗi cặp (tin, ứng viên); trả (hội thoại, mới tạo?)."""
    existing = Conversation.objects.filter(job=job, candidate=candidate).first()
    if existing is not None:
        return existing, False
    try:
        with transaction.atomic():
            conversation = Conversation.objects.create(
                job=job, company_id=job.company_id, candidate=candidate, origin=origin
            )
    except IntegrityError:
        # Hai phía bấm cùng lúc: ràng buộc duy nhất giữ đúng một hội thoại.
        return Conversation.objects.get(job=job, candidate=candidate), False
    conversation = Conversation.objects.select_for_update().get(pk=conversation.pk)
    append_message(
        conversation,
        sender=None,
        role=Role.SYSTEM,
        kind=Message.Kind.SYSTEM,
        payload={'event': SystemEvent.STARTED, 'actor_role': str(opened_by_role)},
        reader_role=opened_by_role,
        push=False,
        activity=False,
    )
    return conversation, True


def _ensure_open(job, candidate, role):
    if not connect_enabled():
        raise PermissionDenied(_('ProCV Connect đang tạm tắt.'))
    if not (is_account_accessible(job.posted_by) and is_account_accessible(candidate)):
        raise PermissionDenied(NOT_ALLOWED)
    if is_candidate_blocked(company_id=job.company_id, candidate_id=candidate.pk):
        raise PermissionDenied(NOT_ALLOWED)


@transaction.atomic
def start_candidate_conversation(candidate, job_public_id):
    job = Job.objects.select_related('posted_by').filter(public_id=job_public_id).first()
    if job is None:
        raise NotFound(NOT_ALLOWED)
    application = _current_application(job, candidate)
    if application is None or application.status == Application.Status.WITHDRAWN:
        raise PermissionDenied(NOT_ALLOWED)
    _ensure_open(job, candidate, Role.CANDIDATE)
    conversation, created = _get_or_create(
        job, candidate, Conversation.Origin.APPLICATION, Role.CANDIDATE
    )
    return conversation, created


@transaction.atomic
def start_recruiter_conversation(recruiter, *, application_public_id='', invitation_public_id=''):
    ensure_recruiter_candidate_data_access(recruiter)
    if application_public_id:
        source = (
            Application.objects.select_related('job__posted_by', 'candidate')
            .filter(public_id=application_public_id, job__posted_by=recruiter, is_current=True)
            .first()
        )
        origin = Conversation.Origin.APPLICATION
    else:
        source = (
            CandidateSearchInvitation.objects.select_related('job__posted_by', 'candidate')
            .filter(
                public_id=invitation_public_id,
                job__posted_by=recruiter,
                status=CandidateSearchInvitation.Status.ACCEPTED,
            )
            .first()
        )
        origin = Conversation.Origin.INVITATION
    if source is None:
        raise NotFound(NOT_ALLOWED)
    job, candidate = source.job, source.candidate
    _ensure_open(job, candidate, Role.RECRUITER)
    conversation, created = _get_or_create(job, candidate, origin, Role.RECRUITER)
    return conversation, created


@transaction.atomic
def mark_read(conversation, role, seq):
    conversation = Conversation.objects.select_for_update().get(pk=conversation.pk)
    seq = min(max(int(seq), 0), conversation.last_seq)
    if seq <= conversation.last_read_seq(role):
        return conversation
    # Chưa đọc = tin của phía kia (kể cả tin hệ thống) sau mốc vừa đọc.
    unread = conversation.messages.filter(seq__gt=seq).exclude(sender_role=role).count()
    if role == Role.CANDIDATE:
        conversation.candidate_last_read_seq = seq
        conversation.candidate_unread = unread
        fields = ['candidate_last_read_seq', 'candidate_unread']
    else:
        conversation.recruiter_last_read_seq = seq
        conversation.recruiter_unread = unread
        fields = ['recruiter_last_read_seq', 'recruiter_unread']
    conversation.save(update_fields=fields)
    conversation.job = Job.objects.only('posted_by_id').get(pk=conversation.job_id)
    push_read(conversation, role)
    return conversation


@transaction.atomic
def clear_conversation(conversation, role):
    """Xóa phía mình: ẩn mọi tin hiện có; bên kia giữ nguyên, tin mới hiện lại hội thoại."""
    conversation = Conversation.objects.select_for_update().get(pk=conversation.pk)
    prefix = 'candidate' if role == Role.CANDIDATE else 'recruiter'
    setattr(conversation, f'{prefix}_cleared_seq', conversation.last_seq)
    setattr(conversation, f'{prefix}_last_read_seq', conversation.last_seq)
    setattr(conversation, f'{prefix}_unread', 0)
    conversation.save(
        update_fields=[f'{prefix}_cleared_seq', f'{prefix}_last_read_seq', f'{prefix}_unread']
    )
    return conversation


@transaction.atomic
def set_conversation_block(conversation, role, blocked):
    """Chặn hoặc gỡ chặn nhắn tin trong hội thoại; chỉ người chặn gỡ được."""
    conversation = Conversation.objects.select_for_update().get(pk=conversation.pk)
    field = 'candidate_blocked_at' if role == Role.CANDIDATE else 'recruiter_blocked_at'
    if bool(getattr(conversation, field)) != blocked:
        setattr(conversation, field, timezone.now() if blocked else None)
        conversation.save(update_fields=[field])
        conversation.job = Job.objects.only('posted_by_id').get(pk=conversation.job_id)
        push_conversation_changed(conversation)
    return conversation
