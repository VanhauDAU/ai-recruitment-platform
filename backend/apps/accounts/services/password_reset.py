"""Password-reset token and delivery workflow."""

import secrets

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.utils.html import escape
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.accounts.services.token_cache import atomic_pop
from common.i18n import recipient_language

from ..models import AuthEmailJob, User
from .mailing import frontend_link, send_html_email, site_setting
from .refresh_cookies import PORTAL_ROLE_BY_NAME
from .tokens import revoke_refresh_tokens

_TOKEN_PREFIX = 'password_reset:token:'
_LATEST_PREFIX = 'password_reset:latest:'
_COOLDOWN_PREFIX = 'password_reset:cooldown:'
_INVALID_LINK = gettext_lazy('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.')


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


def request_password_reset(email, portal):
    """Queue a reset link for the portal account of ``email``, if one is eligible.

    Silent on every branch: the endpoint answers identically whether or not the
    address is registered, so callers must not derive anything from it.
    """
    # Import lazily: task delivery imports account services to render email.
    from ..tasks import queue_auth_email

    # Đúng tài khoản của cổng: một email có thể có tài khoản ứng viên và NTD
    # riêng, mỗi bên mật khẩu riêng.
    user = User.objects.filter(
        email__iexact=email,
        role=PORTAL_ROLE_BY_NAME[portal],
        is_deleted=False,
        status=User.Status.ACTIVE,
    ).first()

    # Cooldown im lặng: phản hồi phải giống hệt nhau dù email có tồn tại hay
    # không, nếu không attacker vẫn phân biệt được qua status code/thời gian.
    # Token được sinh trong worker (lúc gửi thật), xem tasks._send.
    if user and cooldown_remaining(user) == 0:
        start_cooldown(user)
        queue_auth_email(
            AuthEmailJob.Kind.PASSWORD_RESET,
            user,
            context={
                'email': user.email,
                'auth_revision': user.auth_revision,
            },
        )


def _reset_token_user(token, portal=None, *, consume=False):
    """Resolve a reset token without allowing an admin token on another portal."""

    identity = consume_token(token) if consume else peek_token(token)
    if not isinstance(identity, dict):
        return None
    user = User.objects.filter(
        pk=identity.get('user_id'),
        is_deleted=False,
    ).first()
    expected_role = PORTAL_ROLE_BY_NAME.get(portal) if portal else None
    if (
        user is None
        or not is_reset_eligible(user)
        or User.objects.normalize_email(user.email) != identity.get('email')
        or user.auth_revision != identity.get('auth_revision')
        or (expected_role is not None and user.role != expected_role)
        # Admin reset links are issued only by the authenticated admin-account
        # workflow and always carry this explicit portal binding.
        or (user.is_admin_role and portal != 'admin')
    ):
        return None
    return user


def validate_reset_token(token, portal=None):
    """Return the account a reset link belongs to without consuming the link."""
    user = _reset_token_user(token, portal)
    if user is None:
        raise DRFValidationError({'detail': _INVALID_LINK})
    return user


def reset_password(token, password, portal=None):
    """Consume a reset link, set the new password and sign out every session."""
    user = _reset_token_user(token, portal, consume=True)
    if user is None:
        raise DRFValidationError({'detail': _INVALID_LINK})

    user.set_password(password)
    fields = ['password', 'updated_at']
    # Nhận được mail ở địa chỉ này = đã chứng minh quyền sở hữu hòm thư.
    if not user.email_verified:
        user.email_verified = True
        fields.append('email_verified')
    user.save(update_fields=fields)
    revoke_refresh_tokens(user)
    return user


def send_password_reset_email(user, *, expected_email=None, expected_auth_revision=None):
    if not is_reset_eligible(user):
        raise ValidationError(
            _('Không thể gửi liên kết đặt lại mật khẩu cho tài khoản không hoạt động.')
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
    with recipient_language(user):
        subject, text, html = _password_reset_content(user, recipient, link)
    send_html_email(subject=subject, text=text, html=html, to=recipient)
    return token


def _password_reset_content(user, recipient, link):
    is_admin = user.is_admin_role
    is_employer = user.role == user.Role.EMPLOYER
    site_name = site_setting('site_name', 'ProCV')
    minutes = settings.PASSWORD_RESET_TTL // 60
    name = user.full_name or recipient
    # Nêu rõ cổng: một email có thể có tài khoản Ứng viên và Nhà tuyển dụng riêng,
    # người dùng cần biết mình đang đặt lại mật khẩu cho tài khoản nào.
    portal_label = (
        _('Quản trị') if is_admin else _('Nhà tuyển dụng') if is_employer else _('Ứng viên')
    )
    accent_color = '#0369a1' if is_admin else '#00b14f'
    values = {
        'portal': portal_label,
        'site_name': site_name,
        'name': name,
        'email': recipient,
        'minutes': minutes,
    }
    html_values = {key: escape(str(value)) for key, value in values.items()}
    validity = _('Liên kết có hiệu lực trong %(minutes)s phút và chỉ dùng được một lần.') % values
    subject = _('Đặt lại mật khẩu tài khoản %(portal)s %(site_name)s') % values
    text = (
        _('Xin chào %(name)s,') % values
        + '\n\n'
        + _('Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản %(email)s.') % values
        + ' '
        + _('Mở liên kết dưới đây để tạo mật khẩu mới:')
        + f'\n{link}\n\n'
        + validity
        + ' '
        + _('Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.')
    )
    request_line = (
        _(
            'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản %(portal)s '
            '<strong>%(email)s</strong>.'
        )
        % html_values
    )
    html = f'''<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">
      <h2 style="color:{accent_color}">{_('Đặt lại mật khẩu tài khoản %(portal)s') % html_values}</h2>
      <p>{_('Xin chào <strong>%(name)s</strong>,') % html_values}</p>
      <p>{request_line}</p>
      <p style="text-align:center;margin:28px 0"><a href="{link}" style="background:{accent_color};color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:bold;display:inline-block">{_('Tạo mật khẩu mới')}</a></p>
      <p style="font-size:13px;color:#666">{_('Hoặc mở liên kết:')} <br>{link}</p>
      <p style="font-size:12px;color:#999">{validity}</p>
    </div>'''
    return subject, text, html
