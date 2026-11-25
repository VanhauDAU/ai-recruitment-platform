"""Ai gửi được tin trong một hội thoại, đọc lại ở mọi lần gửi."""

from django.utils.translation import gettext_lazy

from apps.accounts.services import is_account_accessible
from apps.applications.models import Application
from apps.applications.services import is_candidate_blocked

from ..domain import LockedReason, Role
from .policy import candidate_unanswered_limit, connect_enabled

NOT_ALLOWED = gettext_lazy('Bạn chưa thể nhắn tin về tin tuyển dụng này.')


def visible_status(application, published_history=None):
    """Trạng thái hồ sơ ứng viên đã được báo; quyết định còn trong cửa sổ hoàn tác chưa tính."""
    if application is None:
        return None
    return application.candidate_visible_status(published_history)


def lock_reason(conversation, role, *, application=None, blocked=None, status=None):
    """Lý do một phía không gửi được tin; '' khi gửi được.

    ``blocked`` nhận giá trị đã annotate ở selector để danh sách không truy vấn thêm;
    ``status`` là trạng thái hồ sơ đã báo ứng viên (tính sẵn ở danh sách).
    """
    if not connect_enabled():
        return LockedReason.DISABLED
    recruiter = conversation.job.posted_by
    if not (is_account_accessible(recruiter) and is_account_accessible(conversation.candidate)):
        return LockedReason.ACCOUNT
    if blocked is None:
        blocked = is_candidate_blocked(
            company_id=conversation.company_id, candidate_id=conversation.candidate_id
        )
    if blocked:
        # Ứng viên không được biết mình bị chặn (luật chặn theo công ty).
        return LockedReason.UNAVAILABLE if role == Role.CANDIDATE else LockedReason.BLOCKED
    if conversation.blocked_by(role):
        return LockedReason.BLOCKED_BY_ME
    peer = Role.RECRUITER if role == Role.CANDIDATE else Role.CANDIDATE
    if conversation.blocked_by(peer):
        # Bên bị chặn chỉ thấy câu trung lập, như chặn theo công ty.
        return LockedReason.UNAVAILABLE
    if application is not None and application.status == Application.Status.WITHDRAWN:
        return LockedReason.WITHDRAWN
    if application is not None:
        # Theo trạng thái đã báo ứng viên, nên NTD vẫn hoàn tác được trong 15 giây
        # mà hội thoại không đóng sớm.
        status = status or visible_status(application)
        if status == Application.Status.REJECTED:
            return LockedReason.CLOSED
    return LockedReason.NONE


def candidate_limit_remaining(conversation, role):
    """Số tin ứng viên còn gửi được khi NTD chưa trả lời; None khi không áp giới hạn."""
    if role != Role.CANDIDATE or conversation.recruiter_replied_at is not None:
        return None
    sent = conversation.messages.filter(sender_role=Role.CANDIDATE).count()
    return max(candidate_unanswered_limit() - sent, 0)
