"""Dữ liệu trả cho client, dùng chung bởi REST và sự kiện socket.

Một nơi dựng payload nên tin đẩy qua socket không bao giờ chứa nhiều hơn thứ REST
đã cho người nhận đọc (ADR-0032, quyết định 3).
"""

from datetime import timedelta

from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy

from apps.applications.models import Application
from apps.jobs.services import salary_text
from common.storage.media import media_url_from_value

from ..domain import Role
from ..models import InterviewAppointment, Message

CANDIDATE_STATUS_LABELS = {
    Application.Status.SUBMITTED: gettext_lazy('Đã nộp hồ sơ'),
    Application.Status.VIEWED: gettext_lazy('Nhà tuyển dụng đã xem hồ sơ'),
    Application.Status.SHORTLISTED: gettext_lazy('Hồ sơ phù hợp'),
    Application.Status.INTERVIEWED: gettext_lazy('Mời phỏng vấn'),
    Application.Status.ACCEPTED: gettext_lazy('Trúng tuyển'),
    Application.Status.REJECTED: gettext_lazy('Chưa phù hợp'),
    Application.Status.WITHDRAWN: gettext_lazy('Đã rút hồ sơ'),
}


def _province_names(job):
    names = []
    for workplace in job.job_locations.all():
        province = workplace.location.parent or workplace.location
        if province.name not in names:
            names.append(province.name)
    return names


def job_card(job):
    """Thẻ tin hiện tại (đầu hội thoại, cột ngữ cảnh); cần ``job_locations`` đã nạp."""
    return {
        'public_id': job.public_id,
        'title': job.title,
        'slug': job.slug,
        'salary_text': str(salary_text(job)),
        'location_text': ', '.join(_province_names(job)),
        'stopped': job.stopped_at is not None,
    }


def job_snapshot(job):
    """Ảnh chụp thẻ tin lúc gửi, lưu vào ``Message.payload``."""
    return {**job_card(job), 'company_name': job.company.company_name}


def _application(application, role, visible_status):
    if application is None:
        return None
    status = visible_status if role == Role.CANDIDATE else application.status
    label = (
        str(CANDIDATE_STATUS_LABELS[status])
        if role == Role.CANDIDATE
        else str(Application.Status(status).label)
    )
    return {'public_id': application.public_id, 'status': status, 'status_label': label}


def present_conversation(
    conversation, role, *, application=None, visible_status=None, lock='', limit_remaining=None
):
    job = conversation.job
    company = conversation.company
    if role == Role.CANDIDATE:
        counterpart = {
            'name': company.company_name,
            'avatar_url': media_url_from_value(company.logo_url) or None,
        }
    else:
        candidate = conversation.candidate
        counterpart = {
            'name': candidate.full_name or _('Ứng viên'),
            'avatar_url': media_url_from_value(candidate.avatar_url) or None,
        }
    peer = Role.RECRUITER if role == Role.CANDIDATE else Role.CANDIDATE
    last = None
    if conversation.last_message_at:
        last = {
            'preview': conversation.last_message_preview,
            'kind': conversation.last_message_kind,
            'sender_role': conversation.last_sender_role,
            'created_at': conversation.last_message_at,
        }
    return {
        'public_id': conversation.public_id,
        'my_role': str(role),
        'job': job_card(job),
        'company': {
            'public_id': company.public_id,
            'name': company.company_name,
            'logo_url': media_url_from_value(company.logo_url) or None,
        },
        'counterpart': counterpart,
        'application': _application(application, role, visible_status),
        'last_message': last,
        'last_message_at': conversation.last_message_at,
        'last_seq': conversation.last_seq,
        'unread_count': conversation.unread(role),
        'peer_last_read_seq': conversation.last_read_seq(peer),
        'can_send': not lock,
        'locked_reason': str(lock),
        'candidate_limit_remaining': limit_remaining,
        'created_at': conversation.created_at,
    }


def _interview(interview, role):
    if interview is None:
        return None
    now = timezone.now()
    ended = now >= interview.starts_at + timedelta(minutes=interview.duration_minutes)
    is_open = interview.status == InterviewAppointment.Status.PROPOSED
    active = interview.status in (
        InterviewAppointment.Status.PROPOSED,
        InterviewAppointment.Status.RESCHEDULE_REQUESTED,
        InterviewAppointment.Status.ACCEPTED,
    )
    return {
        'public_id': interview.public_id,
        'starts_at': interview.starts_at,
        'duration_minutes': interview.duration_minutes,
        'mode': interview.mode,
        'location': interview.location,
        'meeting_url': interview.meeting_url,
        'note': interview.note,
        'status': interview.status,
        'candidate_note': interview.candidate_note,
        'responded_at': interview.responded_at,
        'ended': ended,
        'actions': {
            'respond': role == Role.CANDIDATE and is_open and interview.starts_at > now,
            'cancel': role == Role.RECRUITER and active and not ended,
            # Ứng viên xin đổi giờ (hoặc NTD tự đổi trước giờ hẹn): mở form với chi tiết cũ.
            'reschedule': role == Role.RECRUITER and active and not ended,
            # Qua giờ hẹn đã nhận: NTD ra kết quả ngay trên thẻ (Trúng tuyển / Không phù hợp).
            'decide': role == Role.RECRUITER
            and ended
            and interview.status == InterviewAppointment.Status.ACCEPTED
            and interview.application.status == Application.Status.INTERVIEWED,
        },
        'application_public_id': interview.application.public_id
        if role == Role.RECRUITER
        else None,
    }


def present_message(message, role):
    kind = message.kind
    payload = message.payload or {}
    erased = message.erased_at is not None
    has_file = bool(message.attachment_key) and not erased
    return {
        'public_id': message.public_id,
        'seq': message.seq,
        'client_id': str(message.client_id) if message.client_id else None,
        'kind': kind,
        'sender_role': message.sender_role,
        'mine': message.sender_role == role and kind != Message.Kind.SYSTEM,
        'body': '' if erased else message.body,
        'erased': erased,
        'created_at': message.created_at,
        'job': payload.get('job') if kind == Message.Kind.JOB else None,
        'cv': (
            {
                'title': payload.get('cv_title', ''),
                'cv_type': payload.get('cv_type', ''),
                'has_file': bool(message.cv_version_id and message.cv_version.source_file_key),
            }
            if kind == Message.Kind.CV and not erased
            else None
        ),
        'file': (
            {
                'name': message.attachment_name,
                'content_type': message.attachment_type,
                'size': message.attachment_size,
            }
            if kind in (Message.Kind.FILE, Message.Kind.IMAGE) and has_file
            else None
        ),
        'interview': _interview(message.interview, role)
        if kind == Message.Kind.INTERVIEW
        else None,
        'system': (
            {'event': payload.get('event', ''), 'actor_role': payload.get('actor_role', 'system')}
            if kind == Message.Kind.SYSTEM
            else None
        ),
    }
