"""Administrator security actions: revoke sessions, resend verification or reset mail."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext as _

from apps.accounts.domain.impact_token_rules import decode_impact_token

from ..models import (
    AuthEmailJob,
    AuthSession,
    User,
)
from . import auth_sessions
from .admin_account_common import (
    admin_actor_kwargs,
    assert_audit_revision,
    clean_admin_reason,
    ensure_account_write_allowed,
)
from .admin_audit import record_admin_action


def confirm_revoke_account_sessions(user, *, reason, impact_token, actor):
    reason = clean_admin_reason(reason)
    ensure_account_write_allowed(actor, user)
    claims = decode_impact_token(
        impact_token,
        operation='account.sessions.revoke',
        resource_key=f'account:{user.public_id}',
        normalized_payload={'reason': reason},
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        sessions = list(
            AuthSession.objects.select_for_update().filter(user=user, revoked_at__isnull=True)
        )
        assert_audit_revision(claims)
        for session in sessions:
            auth_sessions.revoke_session(session)
        record_admin_action(
            **admin_actor_kwargs(actor),
            action='revoke_account_sessions',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'reason': reason,
                'revoked_session_count': len(sessions),
            },
        )
        return len(sessions)


def queue_account_security_email(user, *, kind, actor, reason=None):
    from ..tasks import queue_auth_email
    from .password_reset import is_reset_eligible

    audit_reason = (
        clean_admin_reason(reason)
        if kind == AuthEmailJob.Kind.PASSWORD_RESET
        else (reason or '').strip()
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_account_write_allowed(actor, user)
        if kind == AuthEmailJob.Kind.VERIFICATION and user.email_verified:
            raise ValidationError(_('Email của tài khoản đã được xác minh.'))
        if kind == AuthEmailJob.Kind.PASSWORD_RESET and not is_reset_eligible(user):
            raise ValidationError(
                _(
                    'Chỉ có thể gửi liên kết đặt lại mật khẩu cho tài khoản đang hoạt động. '
                    'Hãy mở khóa tài khoản trước.'
                )
            )
        job = queue_auth_email(kind, user)
        record_admin_action(
            **admin_actor_kwargs(actor),
            action=(
                'send_account_password_reset'
                if kind == AuthEmailJob.Kind.PASSWORD_RESET
                else 'resend_account_verification'
            ),
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                **({'reason': audit_reason} if audit_reason else {}),
            },
        )
        return job
