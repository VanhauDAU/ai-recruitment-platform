"""Email delivery for administrator invitations."""

from django.conf import settings
from django.utils.html import escape

from ..admin_invitation_tokens import create_admin_invitation_token
from ..models import AdminInvitation
from .mailing import frontend_link, send_html_email, site_setting


def send_admin_invitation_email(invitation_public_id, token_version):
    invitation = (
        AdminInvitation.objects.select_related('user', 'target_role__department', 'invited_by')
        .filter(
            public_id=invitation_public_id,
            status=AdminInvitation.Status.PENDING,
            token_version=token_version,
        )
        .first()
    )
    if invitation is None:
        return
    link = frontend_link(
        settings.ADMIN_INVITATION_PATH,
        base_url=settings.ADMIN_FRONTEND_URL,
        token=create_admin_invitation_token(invitation),
    )
    site_name = site_setting('site_name', 'ProCV')
    name = invitation.user.full_name or invitation.user.email
    inviter = invitation.invited_by.full_name or invitation.invited_by.email
    department = invitation.target_role.department.name
    role = invitation.target_role.name
    subject = f'Lời mời tham gia hệ thống quản trị {site_name}'
    text = (
        f'Xin chào {name},\n\n{inviter} đã mời bạn tham gia hệ thống quản trị '
        f'{site_name} với chức danh {role} thuộc {department}.\n'
        f'Hoàn tất tài khoản tại: {link}\n\n'
        'Liên kết có hiệu lực trong 72 giờ và chỉ dùng được một lần.'
    )
    html = f'''<div style="margin:0;background:#f4f7fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div style="background:#0b172a;color:#fff;padding:24px 30px"><strong style="font-size:22px">{escape(site_name)} Admin Console</strong></div>
        <div style="padding:30px;line-height:1.65">
          <p>Xin chào <strong>{escape(name)}</strong>,</p>
          <p><strong>{escape(inviter)}</strong> đã mời bạn tham gia hệ thống quản trị.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px">
            <div><strong>Phòng ban:</strong> {escape(department)}</div>
            <div><strong>Chức danh:</strong> {escape(role)}</div>
          </div>
          <p style="text-align:center;margin:28px 0"><a href="{escape(link)}" style="background:#0369a1;color:#fff;text-decoration:none;padding:13px 28px;border-radius:9px;font-weight:700;display:inline-block">Hoàn tất tài khoản</a></p>
          <p style="font-size:13px;color:#64748b">Liên kết có hiệu lực trong 72 giờ và chỉ dùng được một lần. Xác thực hai yếu tố qua email sẽ được bật tự động.</p>
        </div>
      </div>
    </div>'''
    send_html_email(subject=subject, text=text, html=html, to=invitation.user.email)
