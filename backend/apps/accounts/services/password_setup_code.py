"""Mã xác minh qua email để tài khoản OAuth đặt mật khẩu lần đầu.

Tài khoản chỉ đăng nhập bằng mạng xã hội không có mật khẩu hiện tại để chứng
minh chủ sở hữu. Mã 6 số gửi tới email tài khoản thay cho việc đăng nhập lại
provider: người chỉ cầm phiên/token bị lộ không đặt được mật khẩu để chiếm tài
khoản lâu dài. Mã sinh trong worker lúc gửi thật; cache chỉ giữ bản băm.
"""

import hashlib
import hmac
import secrets
import time

from django.conf import settings
from django.core.cache import cache
from django.utils.html import escape
from django.utils.translation import gettext as _

from apps.sitecontent.selectors import email_brand_color, get_string_setting
from common.i18n import recipient_language

from ..models import AuthEmailJob
from .exceptions import PasswordSetupCodeCooldown
from .mailing import send_html_email

MAX_ATTEMPTS = 5
_CODE_PREFIX = 'password_setup:code:'
_COOLDOWN_PREFIX = 'password_setup:cooldown:'


def _code_key(user_id):
    return f'{_CODE_PREFIX}{user_id}'


def _cooldown_key(user_id):
    return f'{_COOLDOWN_PREFIX}{user_id}'


def _digest(user, code):
    # Gắn auth_revision: đổi email/khóa tài khoản sau khi gửi làm mã cũ mất hiệu lực.
    message = f'{user.pk}:{user.auth_revision}:{code}'.encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def cooldown_remaining(user):
    expires_at = cache.get(_cooldown_key(user.pk))
    return max(0, int(expires_at - time.time())) if expires_at else 0


def request_code(user):
    """Xếp email chứa mã vào outbox; chặn gửi dồn bằng cooldown theo tài khoản."""
    # Import lazily: task delivery imports account services to render email.
    from ..tasks import queue_auth_email

    remaining = cooldown_remaining(user)
    if remaining:
        raise PasswordSetupCodeCooldown(remaining)
    cooldown = settings.PASSWORD_SETUP_CODE_RESEND_COOLDOWN
    cache.set(_cooldown_key(user.pk), time.time() + cooldown, cooldown)
    queue_auth_email(
        AuthEmailJob.Kind.PASSWORD_SETUP_CODE,
        user,
        context={'email': user.email, 'auth_revision': user.auth_revision},
    )
    return cooldown


def issue_code(user):
    code = f'{secrets.randbelow(10**6):06d}'
    ttl = settings.PASSWORD_SETUP_CODE_TTL
    entry = {'digest': _digest(user, code), 'attempts': 0, 'expires_at': time.time() + ttl}
    cache.set(_code_key(user.pk), entry, ttl)
    return code


def verify_code(user, code):
    """Đúng thì tiêu thụ mã; sai quá MAX_ATTEMPTS lần thì hủy mã, phải gửi lại."""
    key = _code_key(user.pk)
    entry = cache.get(key)
    if not isinstance(entry, dict) or not code:
        return False
    if hmac.compare_digest(entry['digest'], _digest(user, str(code).strip())):
        cache.delete(key)
        return True
    entry['attempts'] += 1
    remaining_ttl = int(entry['expires_at'] - time.time())
    if entry['attempts'] >= MAX_ATTEMPTS or remaining_ttl <= 0:
        cache.delete(key)
    else:
        cache.set(key, entry, remaining_ttl)
    return False


def send_code_email(user, *, expected_email, expected_auth_revision):
    """Gửi mã nếu danh tính vẫn như lúc xếp hàng; trả False để hủy job cũ."""
    if (
        user.has_usable_password()
        or not expected_email
        or user.email.lower() != expected_email.lower()
        or user.auth_revision != expected_auth_revision
    ):
        return False
    code = issue_code(user)
    with recipient_language(user):
        subject, text, html = _content(user, code)
    send_html_email(subject=subject, text=text, html=html, to=user.email)
    return True


def _content(user, code):
    values = {
        'site_name': get_string_setting('site_name', 'ProCV'),
        'name': user.full_name or user.email,
        'minutes': settings.PASSWORD_SETUP_CODE_TTL // 60,
    }
    html_values = {key: escape(str(value)) for key, value in values.items()}
    validity = (
        _('Mã có hiệu lực trong %(minutes)s phút. Không chia sẻ mã này với bất kỳ ai.') % values
    )
    ignore = _('Nếu bạn không yêu cầu tạo mật khẩu, hãy bỏ qua email này.')
    subject = _('%(code)s là mã xác minh tạo mật khẩu %(site_name)s') % {**values, 'code': code}
    intro = _('Dùng mã dưới đây để tạo mật khẩu đăng nhập cho tài khoản của bạn:')
    text = _('Xin chào %(name)s,') % values + f'\n\n{intro}\n\n{code}\n\n{validity} {ignore}'
    accent = email_brand_color()
    html = f"""<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="color:{accent}">{_('Mã xác minh tạo mật khẩu')}</h2>
      <p>{_('Xin chào <strong>%(name)s</strong>,') % html_values}</p>
      <p>{intro}</p>
      <p style="text-align:center;margin:28px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:{accent}">{code}</p>
      <p style="font-size:12px;color:#999">{validity} {ignore}</p>
    </div>"""
    return subject, text, html
