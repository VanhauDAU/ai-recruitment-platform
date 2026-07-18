"""Email verification token and delivery workflow."""

import secrets

from django.conf import settings
from django.core.cache import cache
from django.utils.html import escape

from common.cache_utils import atomic_pop

from ..models import User
from .mailing import frontend_link, send_html_email, site_setting

_TOKEN_PREFIX = 'email_verify:token:'
_COOLDOWN_PREFIX = 'email_verify:cooldown:'


def _token_key(token):
    return f'{_TOKEN_PREFIX}{token}'


def _cooldown_key(user_id):
    return f'{_COOLDOWN_PREFIX}{user_id}'


def issue_token(user):
    token = secrets.token_urlsafe(32)
    cache.set(_token_key(token), user.pk, settings.EMAIL_VERIFICATION_TTL)
    return token


def consume_token(token):
    return atomic_pop(_token_key(token)) if token else None


def cooldown_remaining(user):
    ttl = cache.ttl(_cooldown_key(user.pk))
    return ttl if ttl and ttl > 0 else 0


def start_cooldown(user):
    cache.set(_cooldown_key(user.pk), 1, settings.EMAIL_VERIFICATION_RESEND_COOLDOWN)


def send_verification_email(user):
    token = issue_token(user)
    is_employer = user.role == User.Role.EMPLOYER
    link = frontend_link(
        settings.EMPLOYER_EMAIL_VERIFICATION_PATH if is_employer else '/tai-khoan/xac-thuc-email',
        base_url=settings.EMPLOYER_FRONTEND_URL if is_employer else settings.FRONTEND_URL,
        token=token,
    )
    site_name = site_setting('site_name', 'ProCV')
    hours = settings.EMAIL_VERIFICATION_TTL // 3600
    name = user.full_name or user.email
    if is_employer:
        recruiter = getattr(user, 'recruiter_profile', None)
        recruiter_code = recruiter.public_id if recruiter else user.public_id
        support_email = site_setting('support_email', '')
        hotline = site_setting('hotline', '')
        subject = f'Xác thực tài khoản Nhà tuyển dụng tại {site_name}'
        text = (
            f'Kính gửi {name} - Mã NTD {recruiter_code},\n\n'
            f'Tài khoản Nhà tuyển dụng của bạn đã được đăng ký thành công với email {user.email}.\n'
            f'Để bảo vệ tài khoản, vui lòng xác thực tại: {link}\n\n'
            f'Liên kết có hiệu lực trong {hours} giờ. Không chia sẻ mật khẩu hoặc liên kết xác thực với người khác.\n'
            f'Hỗ trợ: {hotline} {support_email}'.strip()
        )
        html = f'''<div style="margin:0;background:#f3f5f7;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#3f3f46">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <div style="padding:22px 32px;background:#073e35;color:#fff">
              <strong style="font-size:22px">{escape(site_name)}</strong>
              <span style="display:block;margin-top:5px;font-size:13px;color:#a7f3d0">Cổng Nhà tuyển dụng</span>
            </div>
            <div style="padding:32px;font-size:16px;line-height:1.65">
              <p style="margin-top:0">Kính gửi Quý khách hàng <strong>{escape(name)}</strong> — Mã NTD <strong>{escape(str(recruiter_code))}</strong>,</p>
              <p>Cảm ơn Quý khách đã tin tưởng lựa chọn {escape(site_name)} đồng hành trong quá trình tuyển dụng. Tài khoản Nhà tuyển dụng đã được đăng ký thành công với email <a href="mailto:{escape(user.email)}" style="color:#00a854">{escape(user.email)}</a>.</p>
              <p>Để tăng tính bảo mật, Quý khách vui lòng nhấn nút xác thực dưới đây.</p>
              <p style="text-align:center;margin:26px 0 30px"><a href="{link}" style="background:#00b14f;color:#fff;text-decoration:none;padding:13px 34px;border-radius:8px;font-size:17px;font-weight:700;display:inline-block">Xác thực tài khoản</a></p>
              <div style="background:#f4f6f8;padding:22px 24px;border-radius:6px;color:#52525b">
                <p style="margin-top:0"><strong>Lưu ý bảo mật</strong></p>
                <p>Không chia sẻ mật khẩu hoặc liên kết xác thực với bất kỳ ai. {escape(site_name)} không yêu cầu chuyển khoản vào tài khoản cá nhân.</p>
                <p style="margin-bottom:0">Liên kết có hiệu lực trong <strong>{hours} giờ</strong>. Nếu Quý khách không thực hiện đăng ký này, vui lòng bỏ qua email và liên hệ bộ phận hỗ trợ.</p>
              </div>
              <p style="margin:24px 0 0;font-size:14px;color:#71717a">Cần hỗ trợ: {escape(hotline or 'Hotline trên website')}{' · ' if hotline and support_email else ''}{escape(support_email)}</p>
            </div>
          </div>
        </div>'''
    else:
        subject = f'Xác thực địa chỉ email của bạn tại {site_name}'
        text = (
            f'Xin chào {name},\n\nVui lòng xác thực địa chỉ email của bạn bằng cách mở liên kết dưới đây:\n'
            f'{link}\n\nLiên kết có hiệu lực trong {hours} giờ. Nếu bạn không tạo tài khoản tại '
            f'{site_name}, vui lòng bỏ qua email này.'
        )
        html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="color:#00b14f">Xác thực email của bạn</h2>
          <p>Xin chào <strong>{escape(name)}</strong>,</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại {escape(site_name)}. Nhấn nút bên dưới để xác thực địa chỉ email.</p>
          <p style="text-align:center;margin:28px 0"><a href="{link}" style="background:#00b14f;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;display:inline-block">Xác thực email</a></p>
          <p style="font-size:13px;color:#666">Hoặc mở liên kết: <br>{link}</p>
          <p style="font-size:12px;color:#999">Liên kết có hiệu lực trong {hours} giờ.</p>
        </div>'''
    send_html_email(subject=subject, text=text, html=html, to=user.email)
    return token
