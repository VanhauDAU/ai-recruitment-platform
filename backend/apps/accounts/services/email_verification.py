"""Email verification token and delivery workflow."""

import secrets

from django.conf import settings
from django.core.cache import cache
from django.utils.html import escape
from django.utils.translation import gettext as _

from apps.accounts.services.token_cache import atomic_pop
from apps.sitecontent.selectors import email_brand_color, get_string_setting
from common.i18n import recipient_language

from ..models import User
from .mailing import frontend_link, send_html_email

_TOKEN_PREFIX = 'email_verify:token:'
_COOLDOWN_PREFIX = 'email_verify:cooldown:'


def _token_key(token):
    return f'{_TOKEN_PREFIX}{token}'


def _cooldown_key(user_id):
    return f'{_COOLDOWN_PREFIX}{user_id}'


def issue_token(user):
    token = secrets.token_urlsafe(32)
    cache.set(
        _token_key(token),
        {
            'user_id': user.pk,
            'email': User.objects.normalize_email(user.email),
        },
        settings.EMAIL_VERIFICATION_TTL,
    )
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
    with recipient_language(user):
        render = _employer_verification if is_employer else _candidate_verification
        subject, text, html = render(user, link)
    send_html_email(subject=subject, text=text, html=html, to=user.email)
    return token


def _employer_verification(user, link):
    brand_color = email_brand_color()
    site_name = get_string_setting('site_name', 'ProCV')
    hours = settings.EMAIL_VERIFICATION_TTL // 3600
    name = user.full_name or user.email
    recruiter = getattr(user, 'recruiter_profile', None)
    recruiter_code = recruiter.public_id if recruiter else user.public_id
    support_email = get_string_setting('support_email', '')
    hotline = get_string_setting('hotline', '')
    values = {
        'site_name': site_name,
        'name': name,
        'code': recruiter_code,
        'email': user.email,
        'link': link,
        'hours': hours,
    }
    html_values = {key: escape(str(value)) for key, value in values.items()}
    subject = _('Xác thực tài khoản Nhà tuyển dụng tại %(site_name)s') % values
    text = (
        _('Kính gửi %(name)s - Mã NTD %(code)s,') % values
        + '\n\n'
        + _('Tài khoản Nhà tuyển dụng của bạn đã được đăng ký thành công với email %(email)s.')
        % values
        + '\n'
        + _('Để bảo vệ tài khoản, vui lòng xác thực tại: %(link)s') % values
        + '\n\n'
        + _(
            'Liên kết có hiệu lực trong %(hours)s giờ. Không chia sẻ mật khẩu hoặc liên kết xác thực với người khác.'
        )
        % values
        + '\n'
        + (_('Hỗ trợ: %(contact)s') % {'contact': f'{hotline} {support_email}'}).strip()
    )
    greeting = (
        _('Kính gửi Quý khách hàng <strong>%(name)s</strong> — Mã NTD <strong>%(code)s</strong>,')
        % html_values
    )
    intro = (
        _(
            'Cảm ơn Quý khách đã tin tưởng lựa chọn %(site_name)s đồng hành trong quá trình tuyển dụng. '
            'Tài khoản Nhà tuyển dụng đã được đăng ký thành công với email '
            '<a href="mailto:%(email)s" style="color:#00a854">%(email)s</a>.'
        )
        % html_values
    )
    security = (
        _(
            'Không chia sẻ mật khẩu hoặc liên kết xác thực với bất kỳ ai. '
            '%(site_name)s không yêu cầu chuyển khoản vào tài khoản cá nhân.'
        )
        % html_values
    )
    validity = (
        _(
            'Liên kết có hiệu lực trong <strong>%(hours)s giờ</strong>. Nếu Quý khách không thực hiện '
            'đăng ký này, vui lòng bỏ qua email và liên hệ bộ phận hỗ trợ.'
        )
        % html_values
    )
    contact = escape(hotline or _('Hotline trên website'))
    separator = ' · ' if hotline and support_email else ''
    html = f'''<div style="margin:0;background:#f3f5f7;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#3f3f46">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <div style="padding:22px 32px;background:#073e35;color:#fff">
              <strong style="font-size:22px">{escape(site_name)}</strong>
              <span style="display:block;margin-top:5px;font-size:13px;color:#a7f3d0">{_('Cổng Nhà tuyển dụng')}</span>
            </div>
            <div style="padding:32px;font-size:16px;line-height:1.65">
              <p style="margin-top:0">{greeting}</p>
              <p>{intro}</p>
              <p>{_('Để tăng tính bảo mật, Quý khách vui lòng nhấn nút xác thực dưới đây.')}</p>
              <p style="text-align:center;margin:26px 0 30px"><a href="{link}" style="background:{brand_color};color:#fff;text-decoration:none;padding:13px 34px;border-radius:8px;font-size:17px;font-weight:700;display:inline-block">{_('Xác thực tài khoản')}</a></p>
              <div style="background:#f4f6f8;padding:22px 24px;border-radius:6px;color:#52525b">
                <p style="margin-top:0"><strong>{_('Lưu ý bảo mật')}</strong></p>
                <p>{security}</p>
                <p style="margin-bottom:0">{validity}</p>
              </div>
              <p style="margin:24px 0 0;font-size:14px;color:#71717a">{_('Cần hỗ trợ: %(contact)s') % {'contact': f'{contact}{separator}{escape(support_email)}'}}</p>
            </div>
          </div>
        </div>'''
    return subject, text, html


def _candidate_verification(user, link):
    brand_color = email_brand_color()
    site_name = get_string_setting('site_name', 'ProCV')
    hours = settings.EMAIL_VERIFICATION_TTL // 3600
    name = user.full_name or user.email
    values = {'site_name': site_name, 'name': name, 'link': link, 'hours': hours}
    html_values = {key: escape(str(value)) for key, value in values.items()}
    subject = _('Xác thực địa chỉ email của bạn tại %(site_name)s') % values
    text = (
        _('Xin chào %(name)s,') % values
        + '\n\n'
        + _('Vui lòng xác thực địa chỉ email của bạn bằng cách mở liên kết dưới đây:')
        + f'\n{link}\n\n'
        + _(
            'Liên kết có hiệu lực trong %(hours)s giờ. Nếu bạn không tạo tài khoản tại '
            '%(site_name)s, vui lòng bỏ qua email này.'
        )
        % values
    )
    intro = (
        _(
            'Cảm ơn bạn đã đăng ký tài khoản tại %(site_name)s. Nhấn nút bên dưới để xác thực địa chỉ email.'
        )
        % html_values
    )
    html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="color:{brand_color}">{_('Xác thực email của bạn')}</h2>
          <p>{_('Xin chào <strong>%(name)s</strong>,') % html_values}</p>
          <p>{intro}</p>
          <p style="text-align:center;margin:28px 0"><a href="{link}" style="background:{brand_color};color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;display:inline-block">{_('Xác thực email')}</a></p>
          <p style="font-size:13px;color:#666">{_('Hoặc mở liên kết:')} <br>{link}</p>
          <p style="font-size:12px;color:#999">{_('Liên kết có hiệu lực trong %(hours)s giờ.') % values}</p>
        </div>'''
    return subject, text, html


def _portal_label(user):
    if user.role == User.Role.ADMIN:
        return _('Quản trị')
    if user.role == User.Role.EMPLOYER:
        return _('Nhà tuyển dụng')
    return _('Ứng viên')


def send_email_changed_notice(
    user,
    old_email,
    *,
    new_email=None,
    admin_initiated=False,
    recipient=None,
):
    """Cảnh báo địa chỉ email CŨ rằng email đăng nhập vừa bị đổi.

    Giúp chủ tài khoản thật phát hiện nếu ai đó chiếm phiên và đổi email để cướp
    tài khoản (OWASP: thông báo out-of-band cho thay đổi nhạy cảm)."""
    new_email = new_email or user.email
    recipient = recipient or old_email
    with recipient_language(user):
        subject, text, html = _email_changed_notice(user, old_email, new_email, admin_initiated)
    send_html_email(subject=subject, text=text, html=html, to=recipient)


def _email_changed_notice(user, old_email, new_email, admin_initiated):
    site_name = get_string_setting('site_name', 'ProCV')
    support_email = get_string_setting('support_email', '')
    values = {
        'portal': _portal_label(user),
        'site_name': site_name,
        'old_email': old_email,
        'new_email': new_email,
        'support': support_email or _('bộ phận hỗ trợ'),
    }
    html_values = {key: escape(str(value)) for key, value in values.items()}
    admin_note = _('Thay đổi được thực hiện bởi quản trị viên theo yêu cầu hỗ trợ đã xác minh.')
    subject = _('Email đăng nhập tài khoản %(portal)s %(site_name)s vừa được thay đổi') % values
    text = (
        _('Xin chào,')
        + '\n\n'
        + _(
            'Email đăng nhập của tài khoản %(portal)s tại %(site_name)s vừa được '
            'đổi từ %(old_email)s sang %(new_email)s.'
        )
        % values
        + (f' {admin_note}' if admin_initiated else '')
        + '\n\n'
        + _(
            'Nếu bạn KHÔNG yêu cầu thay đổi này, tài khoản '
            'của bạn có thể đã bị xâm phạm — hãy liên hệ ngay %(support)s.'
        )
        % values
    )
    changed = (
        _(
            'Email đăng nhập của tài khoản <strong>%(portal)s</strong> tại %(site_name)s vừa được đổi từ '
            '<strong>%(old_email)s</strong> sang <strong>%(new_email)s</strong>.'
        )
        % html_values
    )
    warning = (
        _(
            'Nếu bạn <strong>không</strong> yêu cầu thay đổi này, tài khoản của bạn có thể đã bị '
            'xâm phạm. Vui lòng liên hệ ngay %(support)s để được trợ giúp.'
        )
        % html_values
    )
    html = f"""<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="color:#dc2626">{_('Email đăng nhập vừa được thay đổi')}</h2>
      <p>{changed}</p>
      {f'<p>{admin_note}</p>' if admin_initiated else ''}
      <p style="background:#fef2f2;border-radius:8px;padding:14px 16px;color:#991b1b">{warning}</p>
    </div>"""
    return subject, text, html


def send_account_status_notice(
    user,
    *,
    recipient=None,
    before_status='',
    after_status='',
    occurred_at='',
):
    """Notify the owner without exposing internal reason or evidence."""
    recipient = recipient or user.email
    with recipient_language(user):
        subject, text, html = _account_status_notice(
            user, recipient, before_status, after_status, occurred_at
        )
    send_html_email(subject=subject, text=text, html=html, to=recipient)


def _account_status_notice(user, recipient, before_status, after_status, occurred_at):
    site_name = get_string_setting('site_name', 'ProCV')
    support_email = get_string_setting('support_email', '')
    unknown = _('không xác định')
    status_label = {
        User.Status.ACTIVE: _('được mở lại'),
        User.Status.INACTIVE: _('bị tạm khóa'),
        User.Status.BANNED: _('bị cấm'),
    }.get(after_status, _('được cập nhật'))
    values = {
        'portal': _portal_label(user),
        'site_name': site_name,
        'recipient': recipient,
        'status': status_label,
        'before': before_status or unknown,
        'after': after_status or unknown,
        'occurred_at': occurred_at or unknown,
        'support': support_email or _('bộ phận hỗ trợ'),
    }
    html_values = {key: escape(str(value)) for key, value in values.items()}
    subject = _('Trạng thái tài khoản %(portal)s %(site_name)s vừa thay đổi') % values
    text = (
        _('Xin chào,')
        + '\n\n'
        + _('Tài khoản %(recipient)s tại %(site_name)s vừa %(status)s bởi quản trị viên.') % values
        + ' '
        + _('Thời điểm thao tác: %(occurred_at)s.') % values
        + '\n\n'
        + _('Nếu cần hỗ trợ, vui lòng liên hệ %(support)s.') % values
    )
    changed = (
        _(
            'Tài khoản <strong>%(recipient)s</strong> tại %(site_name)s '
            'vừa <strong>%(status)s</strong> bởi quản trị viên.'
        )
        % html_values
    )
    statuses = _('Trạng thái trước: %(before)s · trạng thái mới: %(after)s.') % html_values
    html = f"""<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2>{_('Trạng thái tài khoản vừa thay đổi')}</h2>
      <p>{changed}</p>
      <p>{statuses}</p>
      <p>{_('Thời điểm thao tác: %(occurred_at)s.') % html_values}</p>
      <p style="background:#f4f6f8;border-radius:8px;padding:14px 16px">
      {_('Nếu cần hỗ trợ, vui lòng liên hệ %(support)s.') % html_values}</p>
    </div>"""
    return subject, text, html
