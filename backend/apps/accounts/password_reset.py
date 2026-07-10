"""Đặt lại mật khẩu qua link email + Redis.

Cùng mô hình với `email_verification`: token ngẫu nhiên nằm trong Redis, tự hết
hạn theo TTL, không cần bảng/migration. Khác 2 điểm vì đây là luồng nhạy cảm hơn:

- Chỉ **một** link còn hiệu lực tại một thời điểm: khoá `latest:<user_id>` giữ
  token mới nhất, xin link mới là link cũ chết ngay.
- Token dùng một lần (`consume_token`) — bấm lại link đã dùng sẽ báo hết hạn.
"""

import secrets

from django.conf import settings
from django.core.cache import cache
from django.utils.html import escape

from common.cache_utils import atomic_pop

from .mailing import frontend_link, send_html_email, site_setting

_TOKEN_PREFIX = 'password_reset:token:'
_LATEST_PREFIX = 'password_reset:latest:'
_COOLDOWN_PREFIX = 'password_reset:cooldown:'


def _token_key(token):
    return f'{_TOKEN_PREFIX}{token}'


def _latest_key(user_id):
    return f'{_LATEST_PREFIX}{user_id}'


def _cooldown_key(user_id):
    return f'{_COOLDOWN_PREFIX}{user_id}'


def issue_token(user):
    """Sinh token mới và vô hiệu hoá token cũ (nếu user đã xin link trước đó)."""
    previous = cache.get(_latest_key(user.pk))
    if previous:
        cache.delete(_token_key(previous))

    token = secrets.token_urlsafe(32)
    cache.set(_token_key(token), user.pk, settings.PASSWORD_RESET_TTL)
    cache.set(_latest_key(user.pk), token, settings.PASSWORD_RESET_TTL)
    return token


def peek_token(token):
    """Đọc user_id mà không tiêu token — dùng để kiểm tra link trước khi hiện form."""
    return cache.get(_token_key(token)) if token else None


def consume_token(token):
    """Đổi token lấy user_id (dùng một lần). Trả None nếu sai/hết hạn."""
    if not token:
        return None
    user_id = atomic_pop(_token_key(token))
    if user_id is None:
        return None
    cache.delete(_latest_key(user_id))
    return user_id


def cooldown_remaining(user):
    """Số giây còn phải chờ trước khi được gửi lại (0 nếu đã hết)."""
    ttl = cache.ttl(_cooldown_key(user.pk))
    return ttl if ttl and ttl > 0 else 0


def start_cooldown(user):
    cache.set(_cooldown_key(user.pk), 1, settings.PASSWORD_RESET_RESEND_COOLDOWN)


def send_password_reset_email(user):
    """Sinh token, dựng link và gửi email đặt lại mật khẩu (HTML + text)."""
    token = issue_token(user)
    link = frontend_link('/reset-password', token=token)
    site_name = site_setting('site_name', 'ProCV')
    minutes = settings.PASSWORD_RESET_TTL // 60
    name = user.full_name or user.email

    subject = f'Đặt lại mật khẩu tài khoản {site_name}'
    text = (
        f'Xin chào {name},\n\n'
        f'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản {user.email}. '
        f'Mở liên kết dưới đây để tạo mật khẩu mới:\n'
        f'{link}\n\n'
        f'Liên kết có hiệu lực trong {minutes} phút và chỉ dùng được một lần. '
        f'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu '
        f'hiện tại của bạn vẫn an toàn.'
    )
    html = f"""
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="color:#00b14f">Đặt lại mật khẩu</h2>
        <p>Xin chào <strong>{escape(name)}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản
           <strong>{escape(user.email)}</strong>. Nhấn nút bên dưới để tạo mật khẩu mới.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="{link}" style="background:#00b14f;color:#fff;text-decoration:none;
             padding:12px 28px;border-radius:9999px;font-weight:bold;display:inline-block">
             Tạo mật khẩu mới
          </a>
        </p>
        <p style="font-size:13px;color:#666">Hoặc mở liên kết: <br>{link}</p>
        <p style="font-size:12px;color:#999">
          Liên kết có hiệu lực trong {minutes} phút và chỉ dùng được một lần.
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này —
          mật khẩu hiện tại của bạn vẫn an toàn.
        </p>
      </div>
    """

    send_html_email(subject=subject, text=text, html=html, to=user.email)
    return token
