"""Administrator invitation lifecycle: invite, resend, revoke and accept."""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.services.admin_invitation_tokens import (
    InvalidAdminInvitationToken,
    decode_admin_invitation_token,
)
from apps.accounts.services.exceptions import AdminPermissionDenied

from ..models import (
    AdminInvitation,
    AuthEmailJob,
    User,
)
from .admin_account_common import (
    admin_actor_kwargs,
    clean_admin_reason,
)
from .admin_audit import record_admin_action

INVITATION_TTL = timedelta(hours=72)


def _queue_invitation_email(invitation):
    from ..tasks import queue_auth_email

    return queue_auth_email(
        AuthEmailJob.Kind.ADMIN_INVITATION,
        invitation.user,
        context={
            'invitation_public_id': invitation.public_id,
            'token_version': invitation.token_version,
        },
    )


def create_admin_invitation(*, email, full_name, reason, actor):
    reason = clean_admin_reason(reason)
    normalized_email = User.objects.normalize_email(email)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        _ensure_superuser_inviter(actor)
        existing = (
            User.objects.select_for_update()
            .filter(email__iexact=normalized_email, role=User.Role.ADMIN)
            .first()
        )
        if existing and existing.status == User.Status.ACTIVE:
            raise ValidationError({'email': _('Email đã có tài khoản quản trị hoạt động.')})
        if existing is None:
            user = User(
                email=normalized_email,
                full_name=full_name.strip(),
                role=User.Role.ADMIN,
                status=User.Status.PENDING,
                is_active=False,
                is_staff=False,
                is_superuser=False,
            )
            user.set_unusable_password()
            user.save()
        else:
            user = existing
            if AdminInvitation.objects.filter(
                user=user,
                status=AdminInvitation.Status.PENDING,
            ).exists():
                raise ValidationError({'email': _('Tài khoản đã có lời mời đang chờ xử lý.')})
            user.full_name = full_name.strip()
            user.status = User.Status.PENDING
            user.is_active = False
            user.is_staff = False
            user.is_superuser = False
            user.save(
                update_fields=[
                    'full_name',
                    'status',
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'updated_at',
                ]
            )
        invitation = AdminInvitation.objects.create(
            user=user,
            invited_by=actor,
            reason=reason,
            expires_at=timezone.now() + INVITATION_TTL,
        )
        record_admin_action(
            **admin_actor_kwargs(actor),
            action='create_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': user.public_id, 'reason': reason},
        )
        _queue_invitation_email(invitation)
        return invitation


def _ensure_superuser_inviter(actor):
    if not actor.is_superuser:
        raise AdminPermissionDenied(_('Chỉ superuser được mời và quản lý tài khoản quản trị.'))


def _lock_invitation(invitation, actor):
    _ensure_superuser_inviter(actor)
    return (
        AdminInvitation.objects.select_for_update(of=('self',))
        .select_related('user')
        .get(pk=invitation.pk)
    )


def resend_admin_invitation(invitation, *, actor):
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_invitation(invitation, actor)
        if invitation.status not in {
            AdminInvitation.Status.PENDING,
            AdminInvitation.Status.EXPIRED,
        }:
            raise ValidationError(_('Lời mời không còn có thể gửi lại.'))
        invitation.status = AdminInvitation.Status.PENDING
        invitation.revoked_at = None
        invitation.token_version += 1
        invitation.expires_at = timezone.now() + INVITATION_TTL
        invitation.save(
            update_fields=[
                'status',
                'revoked_at',
                'token_version',
                'expires_at',
                'updated_at',
            ]
        )
        record_admin_action(
            **admin_actor_kwargs(actor),
            action='resend_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': invitation.user.public_id},
        )
        _queue_invitation_email(invitation)
        return invitation


def revoke_admin_invitation(invitation, *, reason, actor):
    reason = clean_admin_reason(reason)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_invitation(invitation, actor)
        if invitation.status != AdminInvitation.Status.PENDING:
            raise ValidationError(_('Chỉ lời mời đang chờ mới được thu hồi.'))
        invitation.status = AdminInvitation.Status.REVOKED
        invitation.reason = reason
        invitation.revoked_at = timezone.now()
        invitation.token_version += 1
        invitation.save(
            update_fields=[
                'status',
                'reason',
                'revoked_at',
                'token_version',
                'updated_at',
            ]
        )
        record_admin_action(
            **admin_actor_kwargs(actor),
            action='revoke_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': invitation.user.public_id, 'reason': reason},
        )
        return invitation


def resolve_admin_invitation(token):
    claims = decode_admin_invitation_token(token)
    invitation = (
        AdminInvitation.objects.select_related('user')
        .filter(public_id=claims['invitation'])
        .first()
    )
    if invitation is None or invitation.token_version != claims['version']:
        raise InvalidAdminInvitationToken(_('Liên kết mời không còn hiệu lực.'))
    if invitation.status != AdminInvitation.Status.PENDING:
        raise InvalidAdminInvitationToken(_('Lời mời đã được sử dụng hoặc thu hồi.'))
    if invitation.expires_at <= timezone.now():
        raise InvalidAdminInvitationToken(_('Liên kết mời đã hết hạn.'))
    return invitation


def accept_admin_invitation(*, token, password):
    claims = decode_admin_invitation_token(token)
    with transaction.atomic():
        invitation = (
            AdminInvitation.objects.select_for_update(of=('self',))
            .select_related('user')
            .filter(public_id=claims['invitation'])
            .first()
        )
        if invitation is None or invitation.token_version != claims['version']:
            raise InvalidAdminInvitationToken(_('Liên kết mời không còn hiệu lực.'))
        if invitation.status != AdminInvitation.Status.PENDING:
            raise InvalidAdminInvitationToken(_('Lời mời đã được sử dụng hoặc thu hồi.'))
        if invitation.expires_at <= timezone.now():
            invitation.status = AdminInvitation.Status.EXPIRED
            invitation.save(update_fields=['status', 'updated_at'])
            raise InvalidAdminInvitationToken(_('Liên kết mời đã hết hạn.'))
        user = User.objects.select_for_update().get(pk=invitation.user_id)
        if user.status != User.Status.PENDING:
            raise InvalidAdminInvitationToken(_('Tài khoản không còn ở trạng thái chờ.'))
        user.set_password(password)
        user.email_verified = True
        user.status = User.Status.ACTIVE
        user.is_active = True
        user.save(
            update_fields=[
                'password',
                'email_verified',
                'status',
                'is_active',
                'updated_at',
            ]
        )
        invitation.status = AdminInvitation.Status.ACCEPTED
        invitation.accepted_at = timezone.now()
        invitation.token_version += 1
        invitation.save(update_fields=['status', 'accepted_at', 'token_version', 'updated_at'])
        record_admin_action(
            actor=user,
            source='invitation',
            actor_identifier=user.email,
            action='accept_admin_invitation',
            target_type='user',
            target_public_id=user.public_id,
            payload={'user_public_id': user.public_id},
        )
        return user
