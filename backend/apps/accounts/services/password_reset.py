"""Password-reset token and delivery workflow."""

import secrets

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
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


def issue_token(user, *, email=None, auth_revision=None):
    previous = cache.get(_latest_key(user.pk))
    if previous:
        cache.delete(_token_key(previous))
    token = secrets.token_urlsafe(32)
    identity = {
        'user_id': user.pk,
        'email': type(user).objects.normalize_email(email or user.email),
        'auth_revision': (user.auth_revision if auth_revision is None else int(auth_revision)),
    }
    cache.set(_token_key(token), identity, settings.PASSWORD_RESET_TTL)
    cache.set(_latest_key(user.pk), token, settings.PASSWORD_RESET_TTL)
    return token


def peek_token(token):
    return cache.get(_token_key(token)) if token else None


def consume_token(token):
    if not token:
        return None
    identity = atomic_pop(_token_key(token))
    if isinstance(identity, dict) and identity.get('user_id') is not None:
        cache.delete(_latest_key(identity['user_id']))
    return identity


def invalidate_tokens(user):
    token = cache.get(_latest_key(user.pk))
    if token:
        cache.delete(_token_key(token))
    cache.delete(_latest_key(user.pk))


def cooldown_remaining(user):
    ttl = cache.ttl(_cooldown_key(user.pk))
    return ttl if ttl and ttl > 0 else 0


def start_cooldown(user):
    cache.set(_cooldown_key(user.pk), 1, settings.PASSWORD_RESET_RESEND_COOLDOWN)


def is_reset_eligible(user):
    """Return whether a reset link may be delivered or used for this account.

    A reset link must never be a back door into an account that was locked after
    a security decision.  The check is also repeated by validate/confirm views,
    because a status may change after an email job has been queued.
    """

    return not user.is_deleted and user.status == user.Status.ACTIVE and user.is_active


def send_password_reset_email(user, *, expected_email=None, expected_auth_revision=None):
    if not is_reset_eligible(user):
        raise ValidationError(
            'Không thể gửi liên kết đặt lại mật khẩu cho tài khoản không hoạt động.'
        )

    recipient = expected_email or user.email
    revision = user.auth_revision if expected_auth_revision is None else expected_auth_revision
    token = issue_token(user, email=recipient, auth_revision=revision)
    is_admin = user.is_admin_role
    is_employer = user.role == user.Role.EMPLOYER
    link = frontend_link(
        (
            settings.ADMIN_PASSWORD_RESET_PATH
            if is_admin
            else settings.EMPLOYER_PASSWORD_RESET_PATH
            if is_employer
            else '/reset-password'
        ),
        base_url=(
            settings.ADMIN_FRONTEND_URL
            if is_admin
            else settings.EMPLOYER_FRONTEND_URL
            if is_employer
            else settings.FRONTEND_URL
        ),
        token=token,
        **({'portal': 'admin'} if is_admin else {}),
    )
    site_name = site_setting('site_name', 'ProCV')
    minutes = settings.PASSWORD_RESET_TTL // 60
    name = user.full_name or recipient
    # Nêu rõ cổng: một email có thể có tài khoản Ứng viên và Nhà tuyển dụng riêng,
    # người dùng cần biết mình đang đặt lại mật khẩu cho tài khoản nào.
    portal_label = 'Quản trị' if is_admin else 'Nhà tuyển dụng' if is_employer else 'Ứng viên'
    accent_color = '#0369a1' if is_admin else '#00b14f'
    subject = f'Đặt lại mật khẩu tài khoản {portal_label} {site_name}'
    text = (
        f'Xin chào {name},\n\nChúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản {recipient}. '
        f'Mở liên kết dưới đây để tạo mật khẩu mới:\n{link}\n\nLiên kết có hiệu lực trong '
        f'{minutes} phút và chỉ dùng được một lần. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.'
    )
    html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="color:{accent_color}">Đặt lại mật khẩu tài khoản {portal_label}</h2>
      <p>Xin chào <strong>{escape(name)}</strong>,</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản {portal_label} <strong>{escape(recipient)}</strong>.</p>
      <p style="text-align:center;margin:28px 0"><a href="{link}" style="background:{accent_color};color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;display:inline-block">Tạo mật khẩu mới</a></p>
      <p style="font-size:13px;color:#666">Hoặc mở liên kết: <br>{link}</p>
      <p style="font-size:12px;color:#999">Liên kết có hiệu lực trong {minutes} phút và chỉ dùng được một lần.</p>
    </div>'''
    send_html_email(subject=subject, text=text, html=html, to=recipient)
    return token
