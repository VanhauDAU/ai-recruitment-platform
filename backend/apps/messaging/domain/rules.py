"""Hằng số và hàm thuần của ProCV Connect."""

from enum import StrEnum

MAX_BODY_CHARS = 2000
PREVIEW_CHARS = 140
# Socket chỉ chuyển "đang soạn tin" tối đa một lần mỗi khoảng này cho một hội thoại.
TYPING_MIN_INTERVAL_SECONDS = 3
INTERVIEW_ACTIONS = ('accept', 'decline', 'reschedule')


class Role(StrEnum):
    CANDIDATE = 'candidate'
    RECRUITER = 'recruiter'
    SYSTEM = 'system'


class LockedReason(StrEnum):
    """Vì sao một bên không gửi được tin; ứng viên chỉ thấy lý do trung lập khi bị chặn."""

    NONE = ''
    UNAVAILABLE = 'unavailable'
    BLOCKED = 'blocked'
    WITHDRAWN = 'withdrawn'
    # Hồ sơ "Không phù hợp" đã báo cho ứng viên: đóng gửi tin, vẫn xem lịch sử; nộp lại thì mở.
    CLOSED = 'closed'
    # Chính mình chặn nhắn tin trong hội thoại (gỡ được); bị bên kia chặn thì thấy UNAVAILABLE.
    BLOCKED_BY_ME = 'blocked_by_me'
    ACCOUNT = 'account'
    DISABLED = 'disabled'


class SystemEvent(StrEnum):
    STARTED = 'started'
    INTERVIEW_ACCEPTED = 'interview_accepted'
    INTERVIEW_DECLINED = 'interview_declined'
    INTERVIEW_RESCHEDULE_REQUESTED = 'interview_reschedule_requested'
    INTERVIEW_CANCELLED = 'interview_cancelled'


def message_preview(body):
    """Một dòng ngắn cho danh sách hội thoại; tin không phải chữ để giao diện tự ghi."""
    text = ' '.join((body or '').split())
    return text if len(text) <= PREVIEW_CHARS else f'{text[: PREVIEW_CHARS - 1]}…'
