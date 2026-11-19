"""Email delivery for administrator invitations."""

from django.conf import settings
from django.utils.html import escape
from django.utils.translation import gettext as _

from apps.accounts.services.admin_invitation_tokens import create_admin_invitation_token
from common.i18n import recipient_language

from ..models import AdminInvitation
from .mailing import frontend_link, send_html_email, site_setting


def send_admin_invitation_email(invitation_public_id, token_version):
    invitation = (
        AdminInvitation.objects.select_related('user', 'invited_by')
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
    with recipient_language(invitation.user):
        subject, text, html = _invitation_content(invitation, link)
    send_html_email(subject=subject, text=text, html=html, to=invitation.user.email)


def _invitation_content(invitation, link):
    site_name = site_setting('site_name', 'ProCV')
    values = {
        'site_name': site_name,
        'name': invitation.user.full_name or invitation.user.email,
        'inviter': invitation.invited_by.full_name or invitation.invited_by.email,
    }
    html_values = {key: escape(value) for key, value in values.items()}
    validity = _('Liên kết có hiệu lực trong 72 giờ và chỉ dùng được một lần.')
    subject = _('Lời mời tham gia hệ thống quản trị %(site_name)s') % values
    text = (
        _('Xin chào %(name)s,') % values
        + '\n\n'
        + _('%(inviter)s đã mời bạn tham gia hệ thống quản trị %(site_name)s.') % values
        + '\n'
        + _('Hoàn tất tài khoản tại: %(link)s') % {'link': link}
        + '\n\n'
        + validity
    )
    invited = _('<strong>%(inviter)s</strong> đã mời bạn tham gia hệ thống quản trị.') % html_values
    html = f'''<div style="margin:0;background:#f4f7fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div style="background:#0b172a;color:#fff;padding:24px 30px"><strong style="font-size:22px">{escape(site_name)} Admin Console</strong></div>
        <div style="padding:30px;line-height:1.65">
          <p>{_('Xin chào <strong>%(name)s</strong>,') % html_values}</p>
          <p>{invited}</p>
          <p style="text-align:center;margin:28px 0"><a href="{escape(link)}" style="background:#0369a1;color:#fff;text-decoration:none;padding:13px 28px;border-radius:9px;font-weight:700;display:inline-block">{_('Hoàn tất tài khoản')}</a></p>
          <p style="font-size:13px;color:#64748b">{validity}</p>
        </div>
      </div>
    </div>'''
    return subject, text, html
