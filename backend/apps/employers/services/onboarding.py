"""Recruiter phone-verification workflow."""

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.sitecontent.selectors import get_string_setting
from common.email import send_html_email

from ..models import PhoneOtp, RecruiterProfile
from .profiles import get_or_create_recruiter

OTP_TTL = timedelta(minutes=10)
OTP_COOLDOWN = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5


def _hash_otp(code):
    return hashlib.sha256(f'{settings.SECRET_KEY}:{code}'.encode()).hexdigest()


def send_phone_otp(user, phone):
    """Create and email an OTP used to verify a recruiter phone number."""
    conflict = RecruiterProfile.objects.filter(
        Q(verified_phone=phone) | Q(contact_phone=phone)
    ).exclude(user=user)
    if conflict.exists():
        raise ValidationError({
            'phone': 'Đã có nhà tuyển dụng khác xác thực số điện thoại này, vui lòng dùng số khác.'
        })
    if not user.has_usable_password():
        raise ValidationError({
            'password': 'Tài khoản chưa có mật khẩu. Tạo mật khẩu trước khi xác thực số điện thoại.'
        })

    latest = PhoneOtp.objects.filter(user=user).order_by('-created_at').first()
    if latest and timezone.now() - latest.created_at < OTP_COOLDOWN:
        raise ValidationError({'detail': 'Vui lòng chờ 60 giây trước khi gửi lại mã.'})

    code = f'{secrets.randbelow(1_000_000):06d}'
    otp = PhoneOtp.objects.create(
        user=user,
        phone=phone,
        code_hash=_hash_otp(code),
        expires_at=timezone.now() + OTP_TTL,
    )
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
    return otp


def verify_phone_otp(user, code):
    """Verify the latest OTP and attach its phone number to the recruiter."""
    otp = PhoneOtp.objects.filter(
        user=user,
        verified_at__isnull=True,
    ).order_by('-created_at').first()
    if otp is None or otp.expires_at < timezone.now():
        raise ValidationError({'code': 'Mã đã hết hạn hoặc không tồn tại, vui lòng gửi lại mã mới.'})
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        raise ValidationError({'code': 'Bạn đã nhập sai quá số lần cho phép, vui lòng gửi lại mã mới.'})

    otp.attempts += 1
    if otp.code_hash != _hash_otp(code):
        otp.save(update_fields=['attempts'])
        raise ValidationError({'code': 'Mã xác thực không đúng.'})

    otp.verified_at = timezone.now()
    otp.save(update_fields=['attempts', 'verified_at'])

    recruiter = get_or_create_recruiter(user)
    recruiter.contact_phone = otp.phone
    recruiter.verified_phone = otp.phone
    recruiter.phone_verified_at = otp.verified_at
    recruiter.save(update_fields=['contact_phone', 'verified_phone', 'phone_verified_at', 'updated_at'])
    if user.phone != otp.phone:
        user.phone = otp.phone
        user.save(update_fields=['phone', 'updated_at'])
    return recruiter
