"""Welcome email sent once after a newly created account has a verified email."""

from django.conf import settings
from django.utils.html import escape
from django.utils.translation import gettext as _

from apps.sitecontent.selectors import email_brand_color, get_string_setting
from common.i18n import recipient_language

from ..models import User
from .mailing import frontend_link, send_html_email


def _candidate_welcome(user):
    brand_color = email_brand_color()
    destination = frontend_link('/onboard-user')
    site_name = get_string_setting('site_name', 'ProCV')
    support_email = get_string_setting('support_email', '')
    name = user.full_name or user.email
    action = _('Hoàn thiện thông tin tìm việc')
    values = {'site_name': site_name, 'name': name}
    html_values = {key: escape(value) for key, value in values.items()}
    subject = _('Chào mừng bạn đến với %(site_name)s') % values
    text = (
        _('Xin chào %(name)s,') % values
        + '\n\n'
        + _('Chào mừng bạn đến với %(site_name)s.') % values
        + f' {action}: {destination}\n\n'
        + _('Bạn nhận được email này vì vừa tạo tài khoản.')
        + ' '
        + _('Liên hệ hỗ trợ: %(support)s.')
        % {'support': support_email or _('bộ phận hỗ trợ của chúng tôi')}
    )
    intro = (
        _(
            'Cảm ơn bạn đã tạo tài khoản tại %(site_name)s. Hãy bắt đầu bằng cách hoàn thiện thông '
            'tin để có trải nghiệm phù hợp hơn.'
        )
        % html_values
    )
    ignore = _('Nếu bạn không tạo tài khoản này, hãy bỏ qua email hoặc liên hệ %(support)s.') % {
        'support': escape(support_email or _('bộ phận hỗ trợ'))
    }
    html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;background:#f6f8fa;padding:24px">
      <div style="background:{brand_color};color:#fff;padding:24px;border-radius:16px 16px 0 0;text-align:center">
        <div style="font-size:24px;font-weight:700">{escape(site_name)}</div>
        <div style="margin-top:8px;font-size:18px;font-weight:700">{_('Chào mừng bạn!')}</div>
      </div>
      <div style="background:#fff;padding:28px;border-radius:0 0 16px 16px">
        <p>{_('Xin chào <strong>%(name)s</strong>,') % html_values}</p>
        <p>{intro}</p>
        <p style="text-align:center;margin:28px 0"><a href="{destination}" style="background:{brand_color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;display:inline-block">{escape(action)}</a></p>
        <p style="font-size:13px;color:#6b7280">{ignore}</p>
      </div>
    </div>'''
    return subject, text, html


def _employer_welcome(user, context):
    brand_color = email_brand_color()
    site_name = get_string_setting('site_name', 'ProCV')
    support_email = get_string_setting('support_email', 'cskh@procv.vn')
    hotline = get_string_setting('hotline', '')
    zalo_url = get_string_setting('contact_zalo_url', '')
    destination = frontend_link(
        '/tuyendung/app/employer-verify',
        base_url=settings.EMPLOYER_FRONTEND_URL,
    )
    name = user.full_name or user.email
    recruiter = getattr(user, 'recruiter_profile', None)
    recruiter_code = recruiter.public_id if recruiter else user.public_id
    registration_method = (context or {}).get('registration_method', '')
    verification_note = (
        _('Google đã xác thực địa chỉ email cho tài khoản này.')
        if registration_method == User.Provider.GOOGLE
        else _('Địa chỉ email của tài khoản đã được xác thực thành công.')
    )
    values = {'site_name': site_name, 'name': name, 'code': recruiter_code}
    html_values = {key: escape(str(value)) for key, value in values.items()}
    subject = _('Chúc mừng %(name)s đã có tài khoản dành cho nhà tuyển dụng') % values
    support_parts = [part for part in (hotline, support_email, zalo_url) if part]
    support_text = ' · '.join(support_parts) or _('bộ phận hỗ trợ trên website')
    registered = _('Tài khoản Nhà tuyển dụng của Quý khách đã được đăng ký thành công.')
    text = (
        _('Kính gửi Quý khách hàng %(name)s - Mã NTD %(code)s,') % values
        + '\n\n'
        + _(
            'Cảm ơn Quý khách đã tin tưởng và lựa chọn %(site_name)s đồng hành trong quá trình '
            'tuyển dụng.'
        )
        % values
        + f' {registered} {verification_note}\n\n'
        + _('Tiếp tục thiết lập tài khoản: %(link)s') % {'link': destination}
        + '\n\n'
        + _('Hỗ trợ: %(contact)s') % {'contact': support_text}
        + '\n\n'
        + _('Đây là email tự động từ %(site_name)s, vui lòng không trả lời email này.') % values
    )
    hotline_html = (
        f'<li><strong>{_("Hotline CSKH:")}</strong> {escape(hotline)}</li>' if hotline else ''
    )
    email_html = (
        f'<li><strong>{_("Email CSKH:")}</strong> <a href="mailto:{escape(support_email)}" style="color:#0875e1">{escape(support_email)}</a></li>'
        if support_email
        else ''
    )
    zalo_html = (
        f'<li><strong>{_("Zalo CSKH:")}</strong> <a href="{escape(zalo_url)}" style="color:#0875e1">{_("Mở Zalo")}</a></li>'
        if zalo_url
        else ''
    )
    greeting = (
        _('Kính gửi Quý khách hàng <strong>%(name)s</strong> — Mã NTD <strong>%(code)s</strong>,')
        % html_values
    )
    thanks = (
        _(
            'Cảm ơn Quý khách đã tin tưởng và lựa chọn %(site_name)s đồng hành trong quá trình '
            'tuyển dụng.'
        )
        % html_values
    )
    next_steps = _(
        'Quý khách có thể tiếp tục hoàn thiện hồ sơ, khai báo nhu cầu tuyển dụng và các bước '
        'xác thực tài khoản.'
    )
    footer = (
        _('Đây là email tự động từ dịch vụ %(site_name)s. Vui lòng không trả lời email này.')
        % html_values
    )
    html = f'''<div style="margin:0;background:#f2f3f5;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#3f3f46">
      <div style="max-width:640px;margin:0 auto">
        <div style="padding:18px;text-align:center;color:#073e35;font-size:28px;font-weight:800">{escape(site_name)}</div>
        <div style="background:#fff;border:1px solid #e5e7eb">
          <div style="padding:32px;font-size:15px;line-height:1.65">
            <p style="margin-top:0">{greeting}</p>
            <p>{thanks} {registered}</p>
            <p>{escape(verification_note)} {next_steps}</p>
            <p style="text-align:center;margin:28px 0"><a href="{destination}" style="background:{brand_color};color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:16px;font-weight:700;display:inline-block">{_('Tiếp tục thiết lập tài khoản')}</a></p>
            <div style="background:#f4f6f8;padding:20px 24px;color:#52525b">
              <p style="margin-top:0">{_('Trong trường hợp cần hỗ trợ thêm thông tin, Quý khách vui lòng liên hệ:')}</p>
              <ul style="margin-bottom:0;padding-left:22px">{hotline_html}{email_html}{zalo_html}</ul>
            </div>
            <p style="margin:22px 0 0">{_('Trân trọng,')}<br>{_('Đội ngũ %(site_name)s') % html_values}</p>
          </div>
        </div>
        <p style="margin:12px 0 0;text-align:center;color:#ef4444;font-size:12px">{footer}</p>
      </div>
    </div>'''
    return subject, text, html


def send_welcome_email(user, context=None):
    """Send a role-specific, low-risk welcome email after email verification."""
    with recipient_language(user):
        if user.role == User.Role.EMPLOYER:
            subject, text, html = _employer_welcome(user, context or {})
        else:
            subject, text, html = _candidate_welcome(user)
    send_html_email(subject=subject, text=text, html=html, to=user.email)
