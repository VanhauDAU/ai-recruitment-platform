"""Welcome email sent once after a newly created account has a verified email."""

from django.utils.html import escape

from ..models import User
from .mailing import frontend_link, send_html_email, site_setting


def send_welcome_email(user):
    """Send a low-risk welcome email; authentication is handled elsewhere."""
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
