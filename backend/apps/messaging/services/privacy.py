"""Quyền riêng tư: xóa nội dung khi xóa tài khoản, kênh realtime "đang soạn tin"."""

from django.db import transaction
from django.utils import timezone

from common.storage.r2 import private_media_storage

from ..domain import Role
from ..models import Conversation, Message


def erase_user_messages(user):
    """Xóa nội dung và tệp người dùng đã gửi; giữ hàng để seq của hội thoại liền mạch."""
    messages = Message.objects.filter(sender=user, erased_at__isnull=True)
    keys = [key for key in messages.values_list('attachment_key', flat=True) if key]
    count = messages.update(
        body='',
        payload={},
        attachment_key='',
        attachment_name='',
        cv_version=None,
        erased_at=timezone.now(),
    )
    Conversation.objects.filter(last_sender_role=Role.CANDIDATE, candidate=user).update(
        last_message_preview=''
    )
    Conversation.objects.filter(last_sender_role=Role.RECRUITER, job__posted_by=user).update(
        last_message_preview=''
    )

    def delete_files():
        storage = private_media_storage()
        for key in keys:
            storage.delete(key)

    transaction.on_commit(delete_files)
    return count


def typing_target(user_id, public_id):
    """``(người nhận, vai người gõ)`` nếu ``user_id`` thuộc hội thoại; ngược lại None."""
    row = (
        Conversation.objects.filter(public_id=public_id)
        .values('candidate_id', 'job__posted_by_id')
        .first()
    )
    if row is None:
        return None
    if row['candidate_id'] == user_id:
        return row['job__posted_by_id'], Role.CANDIDATE
    if row['job__posted_by_id'] == user_id:
        return row['candidate_id'], Role.RECRUITER
    return None
