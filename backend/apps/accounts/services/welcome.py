"""Welcome email sent once after a newly created account has a verified email."""

from django.conf import settings
from django.utils.html import escape

from ..models import User
from .mailing import frontend_link, send_html_email, site_setting


def _send_candidate_welcome(user):
    destination = frontend_link('/onboard-user')
    site_name = site_setting('site_name', 'ProCV')
    support_email = site_setting('support_email', '')
    name = user.full_name or user.email
    action = 'Hoàn thiện thông tin tìm việc'
    subject = f'Chào mừng bạn đến với {site_name}'
    text = (
        f'Xin chào {name},\n\nChào mừng bạn đến với {site_name}. '
        f'{action}: {destination}\n\n'
        f'Bạn nhận được email này vì vừa tạo tài khoản. '
        f'Liên hệ hỗ trợ: {support_email or "bộ phận hỗ trợ của chúng tôi"}.'
    )
    html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;background:#f6f8fa;padding:24px">
      <div style="background:#00b14f;color:#fff;padding:24px;border-radius:16px 16px 0 0;text-align:center">
        <div style="font-size:24px;font-weight:700">{escape(site_name)}</div>
        <div style="margin-top:8px;font-size:18px;font-weight:700">Chào mừng bạn!</div>
      </div>
      <div style="background:#fff;padding:28px;border-radius:0 0 16px 16px">
        <p>Xin chào <strong>{escape(name)}</strong>,</p>
        <p>Cảm ơn bạn đã tạo tài khoản tại {escape(site_name)}. Hãy bắt đầu bằng cách hoàn thiện thông tin để có trải nghiệm phù hợp hơn.</p>
        <p style="text-align:center;margin:28px 0"><a href="{destination}" style="background:#00b14f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;display:inline-block">{escape(action)}</a></p>
        <p style="font-size:13px;color:#6b7280">Nếu bạn không tạo tài khoản này, hãy bỏ qua email hoặc liên hệ {escape(support_email or 'bộ phận hỗ trợ')}.</p>
      </div>
    </div>'''
    send_html_email(subject=subject, text=text, html=html, to=user.email)


def _send_employer_welcome(user, context):
    site_name = site_setting('site_name', 'ProCV')
    support_email = site_setting('support_email', 'cskh@procv.vn')
    hotline = site_setting('hotline', '')
    zalo_url = site_setting('contact_zalo_url', '')
    destination = frontend_link(
        '/tuyendung/app/employer-verify',
        base_url=settings.EMPLOYER_FRONTEND_URL,
    )
    name = user.full_name or user.email
    recruiter = getattr(user, 'recruiter_profile', None)
    recruiter_code = recruiter.public_id if recruiter else user.public_id
    registration_method = (context or {}).get('registration_method', '')
    verification_note = (
        'Google đã xác thực địa chỉ email cho tài khoản này.'
        if registration_method == User.Provider.GOOGLE
        else 'Địa chỉ email của tài khoản đã được xác thực thành công.'
    )
    subject = f'Chúc mừng {name} đã có tài khoản dành cho nhà tuyển dụng'
    support_parts = [part for part in (hotline, support_email, zalo_url) if part]
    support_text = ' · '.join(support_parts) or 'bộ phận hỗ trợ trên website'
    text = (
        f'Kính gửi Quý khách hàng {name} - Mã NTD {recruiter_code},\n\n'
        f'Cảm ơn Quý khách đã tin tưởng và lựa chọn {site_name} đồng hành trong quá trình tuyển dụng. '
        f'Tài khoản Nhà tuyển dụng của Quý khách đã được đăng ký thành công. {verification_note}\n\n'
        f'Tiếp tục thiết lập tài khoản: {destination}\n\n'
        f'Hỗ trợ: {support_text}\n\n'
        f'Đây là email tự động từ {site_name}, vui lòng không trả lời email này.'
    )
    hotline_html = (
        f'<li><strong>Hotline CSKH:</strong> {escape(hotline)}</li>' if hotline else ''
    )
    email_html = (
        f'<li><strong>Email CSKH:</strong> <a href="mailto:{escape(support_email)}" style="color:#0875e1">{escape(support_email)}</a></li>'
        if support_email else ''
    )
    zalo_html = (
        f'<li><strong>Zalo CSKH:</strong> <a href="{escape(zalo_url)}" style="color:#0875e1">Mở Zalo</a></li>'
        if zalo_url else ''
    )
    html = f'''<div style="margin:0;background:#f2f3f5;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#3f3f46">
      <div style="max-width:640px;margin:0 auto">
        <div style="padding:18px;text-align:center;color:#073e35;font-size:28px;font-weight:800">{escape(site_name)}</div>
        <div style="background:#fff;border:1px solid #e5e7eb">
          <div style="padding:32px;font-size:15px;line-height:1.65">
            <p style="margin-top:0">Kính gửi Quý khách hàng <strong>{escape(name)}</strong> — Mã NTD <strong>{escape(str(recruiter_code))}</strong>,</p>
            <p>Cảm ơn Quý khách đã tin tưởng và lựa chọn {escape(site_name)} đồng hành trong quá trình tuyển dụng. Tài khoản Nhà tuyển dụng của Quý khách đã được đăng ký thành công.</p>
            <p>{escape(verification_note)} Quý khách có thể tiếp tục hoàn thiện hồ sơ, khai báo nhu cầu tuyển dụng và các bước xác thực tài khoản.</p>
            <p style="text-align:center;margin:28px 0"><a href="{destination}" style="background:#00b14f;color:#fff;text-decoration:none;padding:13px 30px;border-radius:6px;font-size:16px;font-weight:700;display:inline-block">Tiếp tục thiết lập tài khoản</a></p>
            <div style="background:#f4f6f8;padding:20px 24px;color:#52525b">
              <p style="margin-top:0">Trong trường hợp cần hỗ trợ thêm thông tin, Quý khách vui lòng liên hệ:</p>
              <ul style="margin-bottom:0;padding-left:22px">{hotline_html}{email_html}{zalo_html}</ul>
            </div>
            <p style="margin:22px 0 0">Trân trọng,<br>Đội ngũ {escape(site_name)}</p>
          </div>
        </div>
        <p style="margin:12px 0 0;text-align:center;color:#ef4444;font-size:12px">Đây là email tự động từ dịch vụ {escape(site_name)}. Vui lòng không trả lời email này.</p>
      </div>
    </div>'''
    send_html_email(subject=subject, text=text, html=html, to=user.email)


def send_welcome_email(user, context=None):
    """Send a role-specific, low-risk welcome email after email verification."""
    if user.role == User.Role.EMPLOYER:
        return _send_employer_welcome(user, context or {})
    return _send_candidate_welcome(user)
