"""Định nghĩa thuần của ProCV Connect, dùng chung cho model, service và consumer."""

from .rules import (
    INTERVIEW_ACTIONS,
    MAX_BODY_CHARS,
    PREVIEW_CHARS,
    TYPING_MIN_INTERVAL_SECONDS,
    LockedReason,
    Role,
    SystemEvent,
    message_preview,
)

__all__ = [
    'INTERVIEW_ACTIONS',
    'MAX_BODY_CHARS',
    'PREVIEW_CHARS',
    'TYPING_MIN_INTERVAL_SECONDS',
    'LockedReason',
    'Role',
    'SystemEvent',
    'message_preview',
]
