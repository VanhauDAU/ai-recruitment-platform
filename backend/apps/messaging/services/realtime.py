"""Đẩy sự kiện ProCV Connect qua socket chung (ADR-0028/0032), sau commit."""

import json

from django.core.serializers.json import DjangoJSONEncoder

from apps.realtime.services import push_to_user

from ..domain import Role
from .presenters import present_message


def participants(conversation):
    """``[(role, user_id)]`` hai phía; phía NTD là người đang phụ trách tin."""
    return [
        (Role.CANDIDATE, conversation.candidate_id),
        (Role.RECRUITER, conversation.job.posted_by_id),
    ]


def _jsonable(event):
    # Channel layer và socket chỉ nhận kiểu JSON thuần (datetime → chuỗi ISO).
    return json.loads(json.dumps(event, cls=DjangoJSONEncoder))


def push_message(conversation, message, *, updated=False):
    for role, user_id in participants(conversation):
        event = {
            'type': 'chat.message.updated' if updated else 'chat.message.created',
            'conversation': conversation.public_id,
            'message': present_message(message, role),
        }
        if not updated:
            event['unread_count'] = conversation.unread(role)
        push_to_user(user_id, _jsonable(event))


def push_read(conversation, role):
    event = {
        'type': 'chat.read',
        'conversation': conversation.public_id,
        'role': str(role),
        'last_read_seq': conversation.last_read_seq(role),
    }
    for _role, user_id in participants(conversation):
        push_to_user(user_id, event)


def push_conversation_changed(conversation, user_ids=None):
    event = {'type': 'chat.conversation.updated', 'conversation': conversation.public_id}
    for user_id in user_ids or [user_id for _role, user_id in participants(conversation)]:
        push_to_user(user_id, event)
