"""Đẩy góp ý / báo lỗi mới sang Telegram để chủ dự án đọc ngay trên điện thoại."""

from __future__ import annotations

import logging
from html import escape

import requests
from django.conf import settings
from django.utils import timezone

from ..models import Feedback

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org/bot{token}/sendMessage'
TELEGRAM_MESSAGE_LIMIT = 4096
SITE_URL = 'https://procv.site'
CATEGORY_ICONS = {Feedback.Category.BUG: '🐞'}


class TelegramDeliveryError(Exception):
    """Lỗi tạm thời (mạng, 429, 5xx): task thử lại."""


def telegram_feedback_enabled():
    return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_FEEDBACK_CHAT_ID)


def _device_line(info):
    if not info:
        return ''
    parts = [
        info.get('viewport') and f'màn {info["viewport"]}',
        info.get('dpr') and f'dpr {info["dpr"]}',
        info.get('standalone') and 'web app',
        info.get('touch') and 'cảm ứng',
        info.get('user_agent'),
    ]
    return ' · '.join(str(part) for part in parts if part)


def feedback_message(feedback):
    """Tin nhắn HTML của Telegram; mọi giá trị người dùng nhập đều được escape."""
    icon = CATEGORY_ICONS.get(feedback.category, '💬')
    sender = feedback.user.email if feedback.user else 'Khách'
    lines = [
        f'{icon} <b>{escape(feedback.get_category_display())}</b> · #{feedback.id}',
        f'👤 {escape(sender)} · {timezone.localtime(feedback.created_at):%d/%m %H:%M}',
    ]
    if feedback.satisfaction:
        lines.append(f'⭐ {escape(feedback.get_satisfaction_display())}')
    if feedback.page_url:
        url = (
            feedback.page_url
            if feedback.page_url.startswith('http')
            else SITE_URL + feedback.page_url
        )
        lines.append(f'🔗 {escape(url)}')
    if device := _device_line(feedback.client_info):
        lines.append(f'📱 {escape(device)}')
    contact = ', '.join(value for value in (feedback.phone, feedback.email) if value)
    if contact and not feedback.user:
        lines.append(f'☎️ {escape(contact)}')
    lines += ['', escape(feedback.content)]
    message = '\n'.join(lines)
    return (
        message[: TELEGRAM_MESSAGE_LIMIT - 1] + '…'
        if len(message) > TELEGRAM_MESSAGE_LIMIT
        else message
    )


def send_feedback_to_telegram(feedback_id, *, session=None):
    """Gửi một góp ý; trả False khi chưa cấu hình hoặc góp ý không còn."""
    if not telegram_feedback_enabled():
        return False
    feedback = Feedback.objects.select_related('user').filter(pk=feedback_id).first()
    if feedback is None:
        return False
    session = session or requests
    try:
        response = session.post(
            TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN),
            json={
                'chat_id': settings.TELEGRAM_FEEDBACK_CHAT_ID,
                'text': feedback_message(feedback),
                'parse_mode': 'HTML',
                'disable_web_page_preview': True,
            },
            timeout=settings.TELEGRAM_TIMEOUT_SECONDS,
        )
    except (requests.Timeout, requests.ConnectionError) as error:
        raise TelegramDeliveryError('telegram_unreachable') from error
    if response.status_code == 429 or response.status_code >= 500:
        raise TelegramDeliveryError(f'telegram_{response.status_code}')
    if response.status_code >= 400:
        # Sai token/chat ID: thử lại không giúp gì. Không ghi token ra log.
        logger.warning(
            'Telegram rejected feedback notification.',
            extra={'feedback_id': feedback_id, 'status_code': response.status_code},
        )
        return False
    return True
