"""Xác thực email qua link + Redis.

Token ngẫu nhiên được lưu trong Redis (cache mặc định) trỏ tới user, tự hết hạn
theo TTL. Một khoá "cooldown" riêng chặn spam gửi lại. Không đụng tới DB nên
không cần bảng/migration cho luồng này.
"""

import secrets

from django.conf import settings
from django.utils.html import escape

from common.cache_utils import atomic_pop

from .mailing import frontend_link, send_html_email, site_setting

_TOKEN_PREFIX = 'email_verify:token:'
_COOLDOWN_PREFIX = 'email_verify:cooldown:'


def _token_key(token):
    return f'{_TOKEN_PREFIX}{token}'


def _cooldown_key(user_id):
    return f'{_COOLDOWN_PREFIX}{user_id}'


def issue_token(user):
    """Sinh token mới cho user và lưu vào Redis với TTL cấu hình."""
    from django.core.cache import cache

    token = secrets.token_urlsafe(32)
    cache.set(_token_key(token), user.pk, settings.EMAIL_VERIFICATION_TTL)
    return token


def consume_token(token):
    """Đổi token lấy user_id (dùng một lần). Trả None nếu sai/hết hạn."""
    if not token:
        return None
    return atomic_pop(_token_key(token))


def cooldown_remaining(user):
    """Số giây còn phải chờ trước khi được gửi lại (0 nếu đã hết)."""
    from django.core.cache import cache

    ttl = cache.ttl(_cooldown_key(user.pk))
    return ttl if ttl and ttl > 0 else 0


def start_cooldown(user):
    from django.core.cache import cache

    cache.set(_cooldown_key(user.pk), 1, settings.EMAIL_VERIFICATION_RESEND_COOLDOWN)


def send_verification_email(user):
    """Sinh token, dựng link và gửi email xác thực (HTML + text) cho user."""
    token = issue_token(user)
    is_employer = user.role == 'employer'
    link = frontend_link(
        settings.EMPLOYER_EMAIL_VERIFICATION_PATH if is_employer else '/tai-khoan/xac-thuc-email',
        base_url=settings.EMPLOYER_FRONTEND_URL if is_employer else settings.FRONTEND_URL,
        token=token,
    )
    site_name = site_setting('site_name', 'ProCV')
    hours = settings.EMAIL_VERIFICATION_TTL // 3600
    name = user.full_name or user.email

    subject = f'Xác thực địa chỉ email của bạn tại {site_name}'
    text = (
        f'Xin chào {name},\n\n'
        f'Vui lòng xác thực địa chỉ email của bạn bằng cách mở liên kết dưới đây:\n'
        f'{link}\n\n'
        f'Liên kết có hiệu lực trong {hours} giờ. Nếu bạn không tạo tài khoản tại '
        f'{site_name}, vui lòng bỏ qua email này.'
    )
    html = f"""
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="color:#00b14f">Xác thực email của bạn</h2>
        <p>Xin chào <strong>{escape(name)}</strong>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại {escape(site_name)}. Nhấn nút bên dưới để
           xác thực địa chỉ email và mở khoá toàn bộ tính năng.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="{link}" style="background:#00b14f;color:#fff;text-decoration:none;
             padding:12px 28px;border-radius:9999px;font-weight:bold;display:inline-block">
             Xác thực email
          </a>
        </p>
        <p style="font-size:13px;color:#666">Hoặc mở liên kết: <br>{link}</p>
        <p style="font-size:12px;color:#999">Liên kết có hiệu lực trong {hours} giờ.</p>
      </div>
    """

    send_html_email(subject=subject, text=text, html=html, to=user.email)
    return token
