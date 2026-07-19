"""Email OTP, TOTP và recovery code cho xác minh đa yếu tố."""

import base64
import hashlib
import hmac
import secrets
import struct
from math import ceil
from time import time

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils.html import escape
from cryptography.fernet import Fernet, InvalidToken

from .mailing import send_html_email, site_setting

PURPOSE_SETUP = 'setup'
PURPOSE_LOGIN = 'login'
PURPOSE_DISABLE = 'disable'
PURPOSE_BACKUP = 'backup'
# Số lần nhập sai tối đa cho một mã trước khi mã bị hủy (chống dò mã 6 số dù đã
# throttle theo IP — kẻ tấn công phân tán IP vẫn không brute-force được).
MAX_VERIFY_ATTEMPTS = 5
_CODE_PREFIX = 'two_factor:code:'
_CHALLENGE_PREFIX = 'two_factor:challenge:'
_EXPIRY_PREFIX = 'two_factor:expiry:'
_ATTEMPTS_PREFIX = 'two_factor:attempts:'
_TOTP_SETUP_PREFIX = 'two_factor:totp-setup:'
TOTP_PERIOD_SECONDS = 30
TOTP_DIGITS = 6
BACKUP_CODE_COUNT = 5
BACKUP_CODE_LENGTH = 8


def _code_key(user_id, purpose):
    return f'{_CODE_PREFIX}{purpose}:{user_id}'


def _challenge_key(challenge):
    return f'{_CHALLENGE_PREFIX}{challenge}'


def _expiry_key(user_id, purpose):
    return f'{_EXPIRY_PREFIX}{purpose}:{user_id}'


def _attempts_key(user_id, purpose):
    return f'{_ATTEMPTS_PREFIX}{purpose}:{user_id}'


def _totp_setup_key(user_id):
    return f'{_TOTP_SETUP_PREFIX}{user_id}'


def _fernet():
    configured_key = settings.TWO_FACTOR_TOTP_ENCRYPTION_KEY
    if configured_key:
        try:
            return Fernet(configured_key.encode())
        except (TypeError, ValueError) as error:
            raise ImproperlyConfigured('TWO_FACTOR_TOTP_ENCRYPTION_KEY must be a valid Fernet key.') from error
    if not settings.DEBUG:
        raise ImproperlyConfigured('TWO_FACTOR_TOTP_ENCRYPTION_KEY must be configured outside DEBUG.')
    # Chỉ phục vụ development/test. Production luôn phải dùng khóa tách riêng.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()))


def encrypt_totp_secret(secret):
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_totp_secret(ciphertext):
    if not ciphertext:
        return ''
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, UnicodeDecodeError):
        return ''


def generate_totp_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')


def start_totp_setup(user):
    secret = generate_totp_secret()
    cache.set(_totp_setup_key(user.pk), secret, settings.TWO_FACTOR_CODE_TTL)
    return secret


def pending_totp_secret(user):
    return cache.get(_totp_setup_key(user.pk), '')


def discard_pending_totp_secret(user):
    cache.delete(_totp_setup_key(user.pk))


def _totp_code(secret, counter):
    padded_secret = secret.upper() + '=' * (-len(secret) % 8)
    digest = hmac.new(base64.b32decode(padded_secret), struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0f
    value = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff
    return str(value % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


def verify_totp_secret(secret, code, *, now=None):
    if not secret or not code or not str(code).isdigit() or len(str(code)) != TOTP_DIGITS:
        return False
    counter = int((time() if now is None else now) // TOTP_PERIOD_SECONDS)
    return any(secrets.compare_digest(_totp_code(secret, candidate), str(code)) for candidate in (counter - 1, counter, counter + 1))


def verify_user_totp(user, code):
    return verify_totp_secret(decrypt_totp_secret(user.two_factor_totp_secret), code)


def generate_backup_codes():
    return [f'{secrets.randbelow(10 ** BACKUP_CODE_LENGTH):0{BACKUP_CODE_LENGTH}d}' for _ in range(BACKUP_CODE_COUNT)]


def replace_backup_codes(user):
    codes = generate_backup_codes()
    user.two_factor_backup_code_hashes = [make_password(code) for code in codes]
    user.save(update_fields=['two_factor_backup_code_hashes', 'updated_at'])
    return codes


def consume_backup_code(user, code):
    """Consume one recovery code exactly once, including concurrent requests."""
    if not code or not str(code).isdigit() or len(str(code)) != BACKUP_CODE_LENGTH:
        return False
    with transaction.atomic():
        locked_user = type(user).objects.select_for_update().get(pk=user.pk)
        hashes = list(locked_user.two_factor_backup_code_hashes or [])
        for index, code_hash in enumerate(hashes):
            if check_password(str(code), code_hash):
                hashes.pop(index)
                locked_user.two_factor_backup_code_hashes = hashes
                locked_user.save(update_fields=['two_factor_backup_code_hashes', 'updated_at'])
                return True
    return False


def enabled_methods(user):
    # Accounts tạo trước migration chỉ có cờ tổng hợp; coi đó là email MFA để
    # không làm họ bị khóa cho đến khi migration data hoàn tất.
    has_totp = bool(user.two_factor_totp_secret)
    has_email = bool(user.two_factor_email_enabled or (user.two_factor_enabled and not has_totp))
    has_backup = bool(user.two_factor_backup_code_hashes)
    return {'email': has_email, 'totp': has_totp, 'backup': has_backup}


def refresh_enabled_flag(user):
    methods = enabled_methods(user)
    user.two_factor_enabled = methods['email'] or methods['totp']
    return methods


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


def _employer_action_label(purpose, target=None):
    if purpose == PURPOSE_SETUP:
        return 'Bật xác thực 2 yếu tố sử dụng email'
    if purpose == PURPOSE_BACKUP:
        return 'Kiểm tra mã dự phòng sử dụng để xác thực 2 yếu tố'
    if purpose == PURPOSE_LOGIN:
        return 'Đăng nhập'
    if purpose == PURPOSE_DISABLE:
        return {
            'totp': 'Tắt xác thực 2 yếu tố sử dụng ứng dụng xác thực (Google Authenticator)',
            'backup': 'Tắt mã dự phòng sử dụng để xác thực 2 yếu tố',
        }.get(target, 'Tắt xác thực 2 yếu tố sử dụng email')
    return 'Xác thực 2 yếu tố'


def send_two_factor_email(user, purpose, *, target=None):
    """Gửi mã đã được phát trước đó; job cũ không thể gửi mã hết hạn."""
    code = cache.get(_code_key(user.pk, purpose))
    if not code:
        return
    site_name = site_setting('site_name', 'ProCV')
    minutes = max(1, settings.TWO_FACTOR_CODE_TTL // 60)
    portal_label = 'Nhà tuyển dụng' if user.is_employer else 'Ứng viên' if user.is_candidate else 'Quản trị viên'
    subject = f'[{site_name}] Mã xác thực 2 yếu tố cho tài khoản {portal_label}'
    action = {
        PURPOSE_LOGIN: 'đăng nhập',
        PURPOSE_DISABLE: 'tắt xác minh 2 bước',
        PURPOSE_BACKUP: 'tạo mã dự phòng',
    }.get(purpose, 'bật xác minh 2 bước')
    if user.is_employer:
        name = user.full_name or user.email
        recruiter = getattr(user, 'recruiter_profile', None)
        recruiter_code = recruiter.public_id if recruiter else user.public_id
        employer_action = _employer_action_label(purpose, target)
        text = (
            f'Kính gửi Quý khách hàng {name} - Mã NTD {recruiter_code},\n\n'
            f'Quý khách vừa yêu cầu {employer_action} từ tài khoản nhà tuyển dụng.\n\n'
            f'Mã xác thực của Quý khách là: {code}\n\n'
            f'Mã có hiệu lực trong {minutes} phút. Không chia sẻ mã này với bất kỳ ai.\n\n'
            f'Trân trọng,\nĐội ngũ {site_name}'
        )
        html = f'''<div style="margin:0;background:#f3f5f7;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#3f3f46">
          <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <div style="padding:22px 32px;background:#073e35;color:#fff"><strong style="font-size:22px">{escape(site_name)}</strong><span style="display:block;margin-top:5px;font-size:13px;color:#a7f3d0">Cổng Nhà tuyển dụng</span></div>
            <div style="padding:32px;font-size:16px;line-height:1.65">
              <p style="margin-top:0">Kính gửi Quý khách hàng <strong>{escape(name)}</strong> — Mã NTD <strong>{escape(str(recruiter_code))}</strong>,</p>
              <p>Quý khách vừa yêu cầu <strong>{escape(employer_action)}</strong> từ tài khoản nhà tuyển dụng.</p>
              <p>Mã xác thực của Quý khách là:</p>
              <p style="margin:24px 0;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#00b14f">{code}</p>
              <div style="background:#f4f6f8;padding:18px 22px;border-radius:6px;color:#52525b"><strong>Lưu ý bảo mật</strong><br>Mã có hiệu lực trong <strong>{minutes} phút</strong>. Không chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là nhân viên {escape(site_name)}.</div>
              <p style="margin-bottom:0">Trân trọng,<br>Đội ngũ {escape(site_name)}</p>
            </div>
          </div>
        </div>'''
        send_html_email(subject=subject, text=text, html=html, to=user.email)
        return

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
