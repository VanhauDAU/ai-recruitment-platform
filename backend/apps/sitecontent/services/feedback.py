"""Product feedback from the floating "Góp ý" button."""

import logging

from django.db import transaction

from ..models import Feedback
from .feedback_telegram import telegram_feedback_enabled

logger = logging.getLogger(__name__)


def submit_feedback(*, user=None, **data):
    # Người đã đăng nhập bỏ trống ô email -> lấy email tài khoản để còn phản hồi được.
    data['email'] = data.get('email') or (user.email if user else '')
    feedback = Feedback.objects.create(user=user, **data)
    if telegram_feedback_enabled():
        feedback_id = feedback.pk

        def enqueue():
            # Imported here: tasks depend on services, not the other way round.
            from ..tasks import notify_feedback_telegram

            try:
                notify_feedback_telegram.delay(feedback_id)
            except Exception:  # noqa: BLE001 - góp ý đã lưu, thông báo chỉ là phụ
                logger.exception('Unable to enqueue Telegram feedback notice %s.', feedback_id)

        transaction.on_commit(enqueue)
    return feedback
