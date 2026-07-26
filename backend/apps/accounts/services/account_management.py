"""Transactional administrator account-management use cases."""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from ..admin_access_cache import bust_admin_permission_cache
from ..admin_access_rules import StaleImpactToken, decode_impact_token
from ..admin_invitation_tokens import (
    InvalidAdminInvitationToken,
    decode_admin_invitation_token,
)
from ..exceptions import AdminPermissionDenied
from ..models import (
    AdminAccessAuditLog,
    AdminInvitation,
    AdminMembership,
    AdminProvisioningScope,
    AdminRole,
    AuthEmailJob,
    AuthSession,
    User,
)
from . import auth_sessions
from .admin_access import assign_membership, record_admin_action

INVITATION_TTL = timedelta(hours=72)
SENSITIVE_PROVISIONING_CODES = frozenset(
    {
        'account.admin.invite',
        'account.admin.manage',
        'admin_access.manage_role',
        'admin_access.manage_staff',
    }
)


def _actor_kwargs(actor):
    return {'actor': actor, 'source': 'api', 'actor_identifier': actor.email}


def _has_permission(actor, code):
    if actor.is_superuser:
        return True
    return AdminMembership.objects.filter(
        user=actor,
        is_active=True,
        role__is_active=True,
        role__department__is_active=True,
        role__permissions__code=code,
        role__permissions__is_active=True,
    ).exists()


def _active_membership(actor, *, lock=False):
    queryset = AdminMembership.objects.filter(
        user=actor,
        is_active=True,
        role__is_active=True,
        role__department__is_active=True,
    ).select_related('role__department')
    if lock:
        queryset = queryset.select_for_update()
    return queryset.first()


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


def _ensure_reason(reason):
    cleaned = (reason or '').strip()
    if not cleaned:
        raise ValidationError({'reason': 'Vui lòng nhập lý do thao tác.'})
    if len(cleaned) > 500:
        raise ValidationError({'reason': 'Lý do không được vượt quá 500 ký tự.'})
    return cleaned


def _target_is_sensitive(role):
    return role.permissions.filter(
        is_active=True,
        code__in=SENSITIVE_PROVISIONING_CODES,
    ).exists()


def _resolve_invitation_scope(actor, target_role, *, lock=False):
    if actor.is_superuser:
        return None
    if not _has_permission(actor, 'account.admin.invite'):
        raise AdminPermissionDenied('Bạn không có quyền mời tài khoản quản trị.')
    membership = _active_membership(actor, lock=lock)
    if membership is None:
        raise ValidationError('Tài khoản chưa có chức danh cấp phát hiệu lực.')
    scopes = AdminProvisioningScope.objects.filter(
        source_role=membership.role,
        target_role=target_role,
        is_active=True,
    )
    if lock:
        scopes = scopes.select_for_update()
    scope = scopes.first()
    if scope is None:
        raise AdminPermissionDenied('Chức danh nằm ngoài phạm vi được cấp.')
    if _target_is_sensitive(target_role):
        raise AdminPermissionDenied('Chức danh nhạy cảm chỉ superuser được phép cấp.')
    return scope


def create_provisioning_scope(*, source_role, target_role, actor):
    if not actor.is_superuser:
        raise ValidationError('Chỉ superuser được cấu hình phạm vi cấp tài khoản.')
    if source_role.pk == target_role.pk or _target_is_sensitive(target_role):
        raise ValidationError(
            {'target_role': 'Không thể uỷ quyền cấp chức danh có quyền quản trị đặc quyền.'}
        )
    with transaction.atomic():
        source_role = AdminRole.objects.select_for_update().get(pk=source_role.pk)
        target_role = AdminRole.objects.select_for_update().get(pk=target_role.pk)
        if (
            not source_role.is_active
            or not source_role.department.is_active
            or not source_role.permissions.filter(
                code='account.admin.invite',
                is_active=True,
            ).exists()
        ):
            raise ValidationError(
                {'source_role': 'Chức danh nguồn chưa có quyền cấp tài khoản hiệu lực.'}
            )
        try:
            scope, created = AdminProvisioningScope.objects.get_or_create(
                source_role=source_role,
                target_role=target_role,
                defaults={'configured_by': actor},
            )
        except IntegrityError as error:
            raise ValidationError('Phạm vi cấp tài khoản đã tồn tại.') from error
        reactivated = not created and not scope.is_active
        if reactivated:
            scope.is_active = True
            scope.configured_by = actor
            scope.save(update_fields=['is_active', 'configured_by', 'updated_at'])
        if created or reactivated:
            record_admin_action(
                **_actor_kwargs(actor),
                action='create_provisioning_scope',
                target_type='provisioning_scope',
                target_public_id=scope.public_id,
                payload={
                    'source_role_public_id': source_role.public_id,
                    'target_role_public_id': target_role.public_id,
                },
            )
        return scope


def _current_revision():
    return AdminAccessAuditLog.objects.aggregate(value=Max('id'))['value'] or 0


def confirm_provisioning_scope_status(
    scope,
    *,
    is_active,
    impact_token,
    actor,
):
    if not actor.is_superuser:
        raise ValidationError('Chỉ superuser được cấu hình phạm vi cấp tài khoản.')
    claims = decode_impact_token(
        impact_token,
        operation='provisioning_scope.status.change',
        resource_key=f'provisioning-scope:{scope.public_id}',
        normalized_payload={'is_active': bool(is_active)},
    )
    with transaction.atomic():
        scope = AdminProvisioningScope.objects.select_for_update().get(pk=scope.pk)
        invitations = list(
            AdminInvitation.objects.select_for_update().filter(
                provisioning_scope=scope,
                status=AdminInvitation.Status.PENDING,
            )
        )
        if _current_revision() != claims['revision']:
            raise StaleImpactToken('Dữ liệu phân quyền đã thay đổi.')
        if scope.is_active == bool(is_active):
            return scope
        scope.is_active = bool(is_active)
        scope.configured_by = actor
        scope.save(update_fields=['is_active', 'configured_by', 'updated_at'])
        revoked_ids = []
        if not is_active:
            now = timezone.now()
            for invitation in invitations:
                invitation.status = AdminInvitation.Status.REVOKED
                invitation.revoked_at = now
                invitation.token_version += 1
                invitation.save(
                    update_fields=['status', 'revoked_at', 'token_version', 'updated_at']
                )
                revoked_ids.append(invitation.public_id)
        record_admin_action(
            **_actor_kwargs(actor),
            action='set_provisioning_scope_active',
            target_type='provisioning_scope',
            target_public_id=scope.public_id,
            payload={
                'is_active': bool(is_active),
                'revoked_invitation_public_ids': revoked_ids,
            },
        )
        return scope


def create_admin_invitation(*, email, full_name, target_role, reason, actor):
    reason = _ensure_reason(reason)
    normalized_email = User.objects.normalize_email(email)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        target_role = (
            AdminRole.objects.select_for_update()
            .select_related('department')
            .get(pk=target_role.pk)
        )
        if not target_role.is_active or not target_role.department.is_active:
            raise ValidationError({'target_role': 'Chức danh hoặc phòng ban đang bị khoá.'})
        if not target_role.permissions.filter(is_active=True).exists():
            raise ValidationError({'target_role': 'Chức danh chưa có quyền hiệu lực.'})
        scope = _resolve_invitation_scope(actor, target_role, lock=True)
        existing = (
            User.objects.select_for_update()
            .filter(email__iexact=normalized_email, role=User.Role.ADMIN)
            .first()
        )
        if existing and (
            existing.status == User.Status.ACTIVE
            or AdminMembership.objects.filter(user=existing, is_active=True).exists()
        ):
            raise ValidationError({'email': 'Email đã có tài khoản quản trị hoạt động.'})
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
                raise ValidationError({'email': 'Tài khoản đã có lời mời đang chờ xử lý.'})
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
            target_role=target_role,
            provisioning_scope=scope,
            invited_by=actor,
            reason=reason,
            expires_at=timezone.now() + INVITATION_TTL,
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='create_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={
                'user_public_id': user.public_id,
                'target_role_public_id': target_role.public_id,
                'source_role_public_id': (
                    scope.source_role.public_id if scope is not None else None
                ),
                'reason': reason,
            },
        )
        _queue_invitation_email(invitation)
        return invitation


def _lock_owned_invitation(invitation, actor):
    invitation = (
        AdminInvitation.objects.select_for_update(of=('self',))
        .select_related('user', 'target_role__department', 'provisioning_scope')
        .get(pk=invitation.pk)
    )
    if not actor.is_superuser and invitation.invited_by_id != actor.pk:
        raise AdminPermissionDenied('Bạn chỉ được quản lý lời mời do chính mình tạo.')
    return invitation


def update_admin_invitation_role(invitation, *, target_role, reason, actor):
    reason = _ensure_reason(reason)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_owned_invitation(invitation, actor)
        if invitation.status != AdminInvitation.Status.PENDING:
            raise ValidationError('Chỉ lời mời đang chờ mới được thay đổi.')
        target_role = (
            AdminRole.objects.select_for_update()
            .select_related('department')
            .get(pk=target_role.pk)
        )
        scope = _resolve_invitation_scope(actor, target_role, lock=True)
        before = invitation.target_role.public_id
        invitation.target_role = target_role
        invitation.provisioning_scope = scope
        invitation.reason = reason
        invitation.token_version += 1
        invitation.expires_at = timezone.now() + INVITATION_TTL
        invitation.save(
            update_fields=[
                'target_role',
                'provisioning_scope',
                'reason',
                'token_version',
                'expires_at',
                'updated_at',
            ]
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='update_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={
                'user_public_id': invitation.user.public_id,
                'before_target_role_public_id': before,
                'target_role_public_id': target_role.public_id,
                'reason': reason,
            },
        )
        _queue_invitation_email(invitation)
        return invitation


def resend_admin_invitation(invitation, *, actor):
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_owned_invitation(invitation, actor)
        if invitation.status not in {
            AdminInvitation.Status.PENDING,
            AdminInvitation.Status.EXPIRED,
        }:
            raise ValidationError('Lời mời không còn có thể gửi lại.')
        _resolve_invitation_scope(actor, invitation.target_role, lock=True)
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
            **_actor_kwargs(actor),
            action='resend_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': invitation.user.public_id},
        )
        _queue_invitation_email(invitation)
        return invitation


def revoke_admin_invitation(invitation, *, reason, actor):
    reason = _ensure_reason(reason)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_owned_invitation(invitation, actor)
        if invitation.status != AdminInvitation.Status.PENDING:
            raise ValidationError('Chỉ lời mời đang chờ mới được thu hồi.')
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
            **_actor_kwargs(actor),
            action='revoke_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': invitation.user.public_id, 'reason': reason},
        )
        return invitation


def resolve_admin_invitation(token):
    claims = decode_admin_invitation_token(token)
    invitation = (
        AdminInvitation.objects.select_related('user', 'target_role__department')
        .prefetch_related('target_role__permissions')
        .filter(public_id=claims['invitation'])
        .first()
    )
    if invitation is None or invitation.token_version != claims['version']:
        raise InvalidAdminInvitationToken('Liên kết mời không còn hiệu lực.')
    if invitation.status != AdminInvitation.Status.PENDING:
        raise InvalidAdminInvitationToken('Lời mời đã được sử dụng hoặc thu hồi.')
    if invitation.expires_at <= timezone.now():
        raise InvalidAdminInvitationToken('Liên kết mời đã hết hạn.')
    return invitation


def accept_admin_invitation(*, token, password):
    claims = decode_admin_invitation_token(token)
    with transaction.atomic():
        invitation = (
            AdminInvitation.objects.select_for_update(of=('self',))
            .select_related(
                'user',
                'target_role__department',
                'provisioning_scope',
                'invited_by',
            )
            .filter(public_id=claims['invitation'])
            .first()
        )
        if invitation is None or invitation.token_version != claims['version']:
            raise InvalidAdminInvitationToken('Liên kết mời không còn hiệu lực.')
        if invitation.status != AdminInvitation.Status.PENDING:
            raise InvalidAdminInvitationToken('Lời mời đã được sử dụng hoặc thu hồi.')
        if invitation.expires_at <= timezone.now():
            invitation.status = AdminInvitation.Status.EXPIRED
            invitation.save(update_fields=['status', 'updated_at'])
            raise InvalidAdminInvitationToken('Liên kết mời đã hết hạn.')
        if invitation.provisioning_scope_id:
            scope = AdminProvisioningScope.objects.select_for_update().get(
                pk=invitation.provisioning_scope_id
            )
            if not scope.is_active:
                raise InvalidAdminInvitationToken('Phạm vi cấp tài khoản đã bị thu hồi.')
        role = (
            AdminRole.objects.select_for_update()
            .select_related('department')
            .get(pk=invitation.target_role_id)
        )
        if (
            not role.is_active
            or not role.department.is_active
            or not role.permissions.filter(is_active=True).exists()
        ):
            raise ValidationError('Chức danh được mời không còn hiệu lực.')
        user = User.objects.select_for_update().get(pk=invitation.user_id)
        if user.status != User.Status.PENDING:
            raise InvalidAdminInvitationToken('Tài khoản không còn ở trạng thái chờ.')
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
        membership = assign_membership(
            user,
            role,
            actor=invitation.invited_by,
            source='invitation',
            actor_identifier=invitation.invited_by.email,
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
            payload={
                'user_public_id': user.public_id,
                'membership_public_id': membership.public_id,
                'target_role_public_id': role.public_id,
            },
        )
        return user


def ensure_account_write_allowed(actor, user, permission):
    if user.is_admin_role:
        if not actor.is_superuser:
            raise AdminPermissionDenied('Chỉ superuser được thay đổi tài khoản quản trị.')
        return
    if not _has_permission(actor, permission):
        raise AdminPermissionDenied()


def update_account_profile(user, *, full_name, phone, actor):
    ensure_account_write_allowed(actor, user, 'account.profile.manage')
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        changed = []
        for field, value in (('full_name', full_name.strip()), ('phone', phone.strip())):
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed.append(field)
        if changed:
            user.save(update_fields=[*changed, 'updated_at'])
            record_admin_action(
                **_actor_kwargs(actor),
                action='update_account_profile',
                target_type='user',
                target_public_id=user.public_id,
                payload={'user_public_id': user.public_id, 'changed_fields': changed},
            )
        return user


def _assert_revision(claims):
    if _current_revision() != claims['revision']:
        raise StaleImpactToken('Dữ liệu tài khoản đã thay đổi.')


def confirm_account_status(user, *, status, reason, impact_token, actor):
    reason = _ensure_reason(reason)
    ensure_account_write_allowed(actor, user, 'account.status.manage')
    if actor.pk == user.pk:
        raise ValidationError('Bạn không thể tự thay đổi trạng thái tài khoản của mình.')
    claims = decode_impact_token(
        impact_token,
        operation='account.status.change',
        resource_key=f'account:{user.public_id}',
        normalized_payload={'status': status, 'reason': reason},
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        sessions = list(
            AuthSession.objects.select_for_update().filter(user=user, revoked_at__isnull=True)
        )
        _assert_revision(claims)
        if user.is_superuser and status != User.Status.ACTIVE:
            remaining = User.objects.filter(
                role=User.Role.ADMIN,
                is_superuser=True,
                status=User.Status.ACTIVE,
                is_active=True,
                is_deleted=False,
            ).exclude(pk=user.pk)
            if not remaining.exists():
                raise ValidationError('Không thể khóa superuser hoạt động cuối cùng.')
        before = user.status
        user.status = status
        user.is_active = status == User.Status.ACTIVE
        user.save(update_fields=['status', 'is_active', 'updated_at'])
        revoked = 0
        if status != User.Status.ACTIVE:
            for session in sessions:
                auth_sessions.revoke_session(session)
                revoked += 1
        record_admin_action(
            **_actor_kwargs(actor),
            action='change_account_status',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'before': before,
                'after': status,
                'reason': reason,
                'revoked_session_count': revoked,
            },
        )
        transaction.on_commit(lambda: bust_admin_permission_cache({user.pk}))
        return user


def confirm_revoke_account_sessions(user, *, reason, impact_token, actor):
    reason = _ensure_reason(reason)
    ensure_account_write_allowed(actor, user, 'account.security.manage')
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
        _assert_revision(claims)
        for session in sessions:
            auth_sessions.revoke_session(session)
        record_admin_action(
            **_actor_kwargs(actor),
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


def queue_account_security_email(user, *, kind, actor):
    from ..tasks import queue_auth_email
    from .password_reset import is_reset_eligible

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_account_write_allowed(actor, user, 'account.security.manage')
        if kind == AuthEmailJob.Kind.VERIFICATION and user.email_verified:
            raise ValidationError('Email của tài khoản đã được xác minh.')
        if kind == AuthEmailJob.Kind.PASSWORD_RESET and not is_reset_eligible(user):
            raise ValidationError(
                'Chỉ có thể gửi liên kết đặt lại mật khẩu cho tài khoản đang hoạt động. '
                'Hãy mở khóa tài khoản trước.'
            )
        job = queue_auth_email(kind, user)
        record_admin_action(
            **_actor_kwargs(actor),
            action=(
                'send_account_password_reset'
                if kind == AuthEmailJob.Kind.PASSWORD_RESET
                else 'resend_account_verification'
            ),
            target_type='user',
            target_public_id=user.public_id,
            payload={'user_public_id': user.public_id},
        )
        return job
