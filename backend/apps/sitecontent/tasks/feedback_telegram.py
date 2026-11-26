"""Gửi góp ý / báo lỗi mới sang Telegram."""

from celery import shared_task

from ..services.feedback_telegram import TelegramDeliveryError, send_feedback_to_telegram


@shared_task(bind=True, max_retries=3)
def notify_feedback_telegram(self, feedback_id):
    """Chỉ nhận id: nội dung góp ý không nằm trong tham số broker."""
    try:
        return send_feedback_to_telegram(feedback_id)
    except TelegramDeliveryError as error:
        raise self.retry(exc=error, countdown=30 * (2**self.request.retries)) from error
