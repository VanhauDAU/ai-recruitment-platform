"""Gửi email OTP xác thực số điện thoại NTD ngoài request cycle.

Mã OTP đi qua THAM SỐ task (nằm tạm ở Redis broker tới khi worker nhận), KHÔNG
qua bảng outbox `AuthEmailJob` như các email auth khác: `PhoneOtp` cố ý chỉ lưu
SHA-256 của mã, nên persist plaintext vào DB để worker đọc lại sẽ phá đúng thiết
kế hash-at-rest đó. Đánh đổi: nếu broker mất message thì người dùng bấm "Gửi lại
mã" — chấp nhận được với OTP có TTL 10 phút.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model

from apps.sitecontent.selectors import get_string_setting
from common.email import send_html_email

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(OSError,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 3},
)
def send_phone_otp_email(self, user_id, phone, code):
    user = get_user_model().objects.filter(pk=user_id).only('pk', 'email').first()
    if user is None:
        logger.warning('Bỏ qua OTP: user %s không còn tồn tại.', user_id)
        return

    site_name = get_string_setting('site_name', 'ProCV')
    sender_name = get_string_setting('email_from_name', settings.EMAIL_FROM_NAME)
    support_email = get_string_setting('support_email', '')
    sender = (
        f'{sender_name} <{settings.EMAIL_FROM_ADDRESS}>'
        if sender_name
        else settings.EMAIL_FROM_ADDRESS
    )
    send_html_email(
        subject=f'Mã xác thực số điện thoại tại {site_name}',
        text=f'Mã xác thực số điện thoại {phone} của bạn là {code}. Mã có hiệu lực trong 10 phút.',
        html=(
            f'<p>Mã xác thực số điện thoại <b>{phone}</b> của bạn là</p>'
            f'<p style="font-size:24px;letter-spacing:4px"><b>{code}</b></p>'
            '<p>Mã có hiệu lực trong 10 phút.</p>'
        ),
        to=user.email,
        from_email=sender,
        reply_to=support_email or None,
    )
