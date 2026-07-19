"""Mã OTP qua email cho thiết lập và đăng nhập hai bước."""

import secrets
from math import ceil
from time import time

from django.conf import settings
from django.core.cache import cache
from django.utils.html import escape

from .mailing import send_html_email, site_setting

PURPOSE_SETUP = 'setup'
PURPOSE_LOGIN = 'login'
PURPOSE_DISABLE = 'disable'
# Số lần nhập sai tối đa cho một mã trước khi mã bị hủy (chống dò mã 6 số dù đã
# throttle theo IP — kẻ tấn công phân tán IP vẫn không brute-force được).
MAX_VERIFY_ATTEMPTS = 5
_CODE_PREFIX = 'two_factor:code:'
_CHALLENGE_PREFIX = 'two_factor:challenge:'
_EXPIRY_PREFIX = 'two_factor:expiry:'
_ATTEMPTS_PREFIX = 'two_factor:attempts:'


def _code_key(user_id, purpose):
    return f'{_CODE_PREFIX}{purpose}:{user_id}'


def _challenge_key(challenge):
    return f'{_CHALLENGE_PREFIX}{challenge}'


def _expiry_key(user_id, purpose):
    return f'{_EXPIRY_PREFIX}{purpose}:{user_id}'


def _attempts_key(user_id, purpose):
    return f'{_ATTEMPTS_PREFIX}{purpose}:{user_id}'


def issue_code(user, purpose):
    """Phát mã mới và thay thế mã cũ cùng mục đích."""
    code = f'{secrets.randbelow(1_000_000):06d}'
    cache.set(_code_key(user.pk, purpose), code, settings.TWO_FACTOR_CODE_TTL)
    cache.set(_expiry_key(user.pk, purpose), time() + settings.TWO_FACTOR_CODE_TTL, settings.TWO_FACTOR_CODE_TTL)
    # Mã mới -> bộ đếm sai được làm mới (gửi lại cho lại đủ số lần thử).
    cache.delete(_attempts_key(user.pk, purpose))
    return code


def code_remaining(user, purpose):
    expires_at = cache.get(_expiry_key(user.pk, purpose))
    return max(0, ceil(expires_at - time())) if expires_at else 0


def _clear_code(user_id, purpose):
    cache.delete(_code_key(user_id, purpose))
    cache.delete(_expiry_key(user_id, purpose))
    cache.delete(_attempts_key(user_id, purpose))


def verify_code(user, purpose, code):
    expected = cache.get(_code_key(user.pk, purpose))
    if not expected:
        return False
    if code and secrets.compare_digest(str(expected), str(code)):
        _clear_code(user.pk, purpose)
        return True
    # Sai: đếm số lần thử; quá ngưỡng thì hủy mã, buộc người dùng gửi lại mã mới.
    attempts = (cache.get(_attempts_key(user.pk, purpose)) or 0) + 1
    if attempts >= MAX_VERIFY_ATTEMPTS:
        _clear_code(user.pk, purpose)
    else:
        cache.set(_attempts_key(user.pk, purpose), attempts, settings.TWO_FACTOR_CODE_TTL)
    return False


def start_login_challenge(user, portal):
    issue_code(user, PURPOSE_LOGIN)
    challenge = secrets.token_urlsafe(32)
    cache.set(
        _challenge_key(challenge),
        {'user_id': user.pk, 'portal': portal or ''},
        settings.TWO_FACTOR_CODE_TTL,
    )
    return challenge


def get_login_challenge(challenge):
    return cache.get(_challenge_key(challenge)) if challenge else None


def consume_login_challenge(challenge):
    if challenge:
        cache.delete(_challenge_key(challenge))


def send_two_factor_email(user, purpose):
    """Gửi mã đã được phát trước đó; job cũ không thể gửi mã hết hạn."""
    code = cache.get(_code_key(user.pk, purpose))
    if not code:
        return
    site_name = site_setting('site_name', 'ProCV')
    minutes = max(1, settings.TWO_FACTOR_CODE_TTL // 60)
    action = {
        PURPOSE_LOGIN: 'đăng nhập',
        PURPOSE_DISABLE: 'tắt xác minh 2 bước',
    }.get(purpose, 'bật xác minh 2 bước')
    subject = f'Mã xác minh {action} tại {site_name}'
    text = (
        f'Mã xác minh để {action} của bạn là: {code}. Mã có hiệu lực trong {minutes} phút. '
        f'Không chia sẻ mã này với bất kỳ ai.'
    )
    html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
      <h2 style="color:#00b14f">Mã xác minh của bạn</h2>
      <p>Xin chào <strong>{escape(user.full_name or user.email)}</strong>,</p>
      <p>Mã dùng để {escape(action)} là:</p>
      <p style="margin:24px 0;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#00b14f">{code}</p>
      <p>Mã có hiệu lực trong <strong>{minutes} phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
    </div>'''
    send_html_email(subject=subject, text=text, html=html, to=user.email)
