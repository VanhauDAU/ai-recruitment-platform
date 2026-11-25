"""Đẩy sự kiện ProCV Connect qua socket chung (ADR-0028/0032), sau commit."""

import json

from django.core.serializers.json import DjangoJSONEncoder

from apps.employers.services import recruiter_readiness_state
from apps.realtime.services import push_to_user

from ..domain import Role
from .presenters import present_message


def recruiter_may_receive(recruiter):
    """NTD chỉ nhận nội dung hội thoại khi còn qua cổng dữ liệu ứng viên (xác thực + DPA)."""
    return bool(recruiter_readiness_state(recruiter)[1]['candidate_data_access'])


def participants(conversation):
    """``[(role, user_id)]`` các phía được nhận sự kiện; phía NTD là người phụ trách tin."""
    rows = [(Role.CANDIDATE, conversation.candidate_id)]
    if recruiter_may_receive(conversation.job.posted_by):
        rows.append((Role.RECRUITER, conversation.job.posted_by_id))
    return rows


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
