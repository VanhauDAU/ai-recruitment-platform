"""Transactional administrator-access use cases."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..admin_access_cache import bust_admin_permission_cache
from ..constants import ADMIN_PERMISSIONS
from ..models import (
    AdminAccessAuditLog,
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
)


def users_affected_by_role(role):
    return set(role.memberships.filter(is_active=True).values_list('user_id', flat=True).distinct())


def users_affected_by_department(department):
    return set(
        AdminMembership.objects.filter(
            role__department=department,
            is_active=True,
        )
        .values_list('user_id', flat=True)
        .distinct()
    )


def users_affected_by_permission(permission):
    return set(
        AdminMembership.objects.filter(
            role__permissions=permission,
            is_active=True,
        )
        .values_list('user_id', flat=True)
        .distinct()
    )


def _audit(
    *,
    actor,
    source,
    actor_identifier,
    action,
    target_type,
    target_public_id,
    payload,
):
    return AdminAccessAuditLog.objects.create(
        actor=actor,
        source=source,
        actor_identifier=actor_identifier,
        action=action,
        target_type=target_type,
        target_public_id=target_public_id,
        payload=payload,
    )


def _schedule_cache_bust(user_ids):
    affected = set(user_ids)
    if affected:
        transaction.on_commit(lambda: bust_admin_permission_cache(affected))


def _valid_memberships(user):
    return (
        AdminMembership.objects.filter(
            user=user,
            is_active=True,
            role__is_active=True,
            role__department__is_active=True,
        )
        .select_related('role__department')
        .order_by('-role__rank', 'assigned_at', 'id')
    )


def _reevaluate_primary(user):
    active_memberships = list(_valid_memberships(user))
    current = next((item for item in active_memberships if item.is_primary), None)
    chosen = current or (active_memberships[0] if active_memberships else None)

    AdminMembership.objects.filter(user=user, is_primary=True).exclude(
        pk=chosen.pk if chosen else None
    ).update(is_primary=False)
    if chosen and not chosen.is_primary:
        chosen.is_primary = True
        chosen.save(update_fields=['is_primary'])
    return chosen


def sync_permission_catalog(*, actor=None, source='management_command', actor_identifier=''):
    registry = {item['code']: item for item in ADMIN_PERMISSIONS}
    changed = {'created': [], 'updated': [], 'deprecated': [], 'reactivated': []}
    affected_user_ids = set()
    with transaction.atomic():
        existing = {item.code: item for item in AdminPermission.objects.select_for_update()}
        for code, definition in registry.items():
            permission = existing.get(code)
            if permission is None:
                AdminPermission.objects.create(**definition)
                changed['created'].append(code)
                continue

            affected_user_ids.update(users_affected_by_permission(permission))
            was_inactive = not permission.is_active
            dirty_fields = []
            for field in ('module', 'label', 'description'):
                value = definition[field]
                if getattr(permission, field) != value:
                    setattr(permission, field, value)
                    dirty_fields.append(field)
            if was_inactive:
                permission.is_active = True
                permission.deprecated_at = None
                dirty_fields.extend(['is_active', 'deprecated_at'])
                changed['reactivated'].append(code)
            if dirty_fields:
                permission.save(update_fields=[*dirty_fields])
                if not was_inactive:
                    changed['updated'].append(code)

        for code, permission in existing.items():
            if code in registry or not permission.is_active:
                continue
            affected_user_ids.update(users_affected_by_permission(permission))
            permission.is_active = False
            permission.deprecated_at = timezone.now()
            permission.save(update_fields=['is_active', 'deprecated_at'])
            changed['deprecated'].append(code)

        if any(changed.values()):
            _audit(
                actor=actor,
                source=source,
                actor_identifier=actor_identifier,
                action='sync_permission_catalog',
                target_type='permission_catalog',
                target_public_id='',
                payload={key: sorted(value) for key, value in changed.items()},
            )
            _schedule_cache_bust(affected_user_ids)
    return changed


def assign_membership(
    user,
    role,
    *,
    actor,
    source='api',
    primary=None,
    actor_identifier='',
):
    if not user.is_admin_role:
        raise ValidationError('Membership chỉ được gán cho tài khoản admin.')
    if not role.is_active or not role.department.is_active:
        raise ValidationError('Không thể gán chức danh hoặc phòng ban đang bị khoá.')

    with transaction.atomic():
        locked = list(AdminMembership.objects.select_for_update().filter(user=user).order_by('id'))
        if any(item.is_active and item.role_id == role.pk for item in locked):
            raise ValidationError('Tài khoản đã có chức danh này.')

        has_valid_membership = any(
            item.is_active and item.role.is_active and item.role.department.is_active
            for item in AdminMembership.objects.filter(user=user).select_related('role__department')
        )
        make_primary = not has_valid_membership or primary is True
        if make_primary:
            AdminMembership.objects.filter(user=user, is_primary=True).update(is_primary=False)
        membership = AdminMembership(
            user=user,
            role=role,
            assigned_by=actor,
            is_primary=make_primary,
        )
        membership.full_clean()
        membership.save()
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='assign_membership',
            target_type='membership',
            target_public_id=membership.public_id,
            payload={
                'membership_public_id': membership.public_id,
                'department': role.department.code,
                'role': role.code,
                'user_public_id': user.public_id,
            },
        )
        _schedule_cache_bust({user.pk})
    return membership


def revoke_membership(
    membership,
    *,
    actor,
    source='api',
    actor_identifier='',
):
    with transaction.atomic():
        membership = (
            AdminMembership.objects.select_for_update()
            .select_related('user', 'role__department')
            .get(pk=membership.pk)
        )
        if not membership.is_active:
            return membership
        was_primary = membership.is_primary
        membership.is_active = False
        membership.is_primary = False
        membership.revoked_by = actor
        membership.revoked_at = timezone.now()
        membership.save(
            update_fields=[
                'is_active',
                'is_primary',
                'revoked_by',
                'revoked_at',
            ]
        )
        promoted = _reevaluate_primary(membership.user) if was_primary else None
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='revoke_membership',
            target_type='membership',
            target_public_id=membership.public_id,
            payload={
                'membership_public_id': membership.public_id,
                'user_public_id': membership.user.public_id,
                'promoted_membership_public_id': promoted.public_id if promoted else None,
            },
        )
        _schedule_cache_bust({membership.user_id})
    return membership


def set_primary_membership(
    user,
    membership,
    *,
    actor,
    source='api',
    actor_identifier='',
):
    with transaction.atomic():
        list(AdminMembership.objects.select_for_update().filter(user=user))
        membership = (
            AdminMembership.objects.select_related('role__department')
            .filter(pk=membership.pk, user=user)
            .first()
        )
        if (
            membership is None
            or not membership.is_active
            or not membership.role.is_active
            or not membership.role.department.is_active
        ):
            raise ValidationError('Membership không còn hiệu lực.')
        current = AdminMembership.objects.filter(user=user, is_active=True, is_primary=True).first()
        if current and current.pk == membership.pk:
            return membership
        AdminMembership.objects.filter(user=user, is_primary=True).update(is_primary=False)
        membership.is_primary = True
        membership.save(update_fields=['is_primary'])
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='set_primary_membership',
            target_type='membership',
            target_public_id=membership.public_id,
            payload={
                'user_public_id': user.public_id,
                'before_membership_public_id': current.public_id if current else None,
                'after_membership_public_id': membership.public_id,
            },
        )
        _schedule_cache_bust({user.pk})
    return membership


def set_role_permissions(
    role,
    desired_active_codes,
    *,
    actor,
    source='api',
    preserve_deprecated=True,
    actor_identifier='',
):
    desired_codes = set(desired_active_codes)
    with transaction.atomic():
        role = AdminRole.objects.select_for_update().get(pk=role.pk)
        desired_permissions = {
            permission.code: permission
            for permission in AdminPermission.objects.filter(code__in=desired_codes)
        }
        missing = desired_codes - set(desired_permissions)
        inactive = {
            code for code, permission in desired_permissions.items() if not permission.is_active
        }
        if missing:
            raise ValidationError(f'Permission không tồn tại: {", ".join(sorted(missing))}.')
        if inactive:
            raise ValidationError(f'Permission đã ngưng kích hoạt: {", ".join(sorted(inactive))}.')

        before = {permission.code: permission for permission in role.permissions.all()}
        deprecated = {
            code: permission
            for code, permission in before.items()
            if not permission.is_active and preserve_deprecated
        }
        final = {**desired_permissions, **deprecated}
        if set(before) == set(final):
            return role

        affected_user_ids = users_affected_by_role(role)
        role.permissions.set(final.values())
        added = sorted(set(final) - set(before))
        removed = sorted(set(before) - set(final))
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='set_role_permissions',
            target_type='role',
            target_public_id=role.public_id,
            payload={
                'role_public_id': role.public_id,
                'before': {'permission_codes': sorted(before)},
                'after': {'permission_codes': sorted(final)},
                'permission_codes_added': added,
                'permission_codes_removed': removed,
            },
        )
        _schedule_cache_bust(affected_user_ids)
    return role


def create_department(
    *,
    code,
    name,
    description='',
    actor,
    source='api',
    actor_identifier='',
):
    with transaction.atomic():
        department = Department.objects.create(
            code=code,
            name=name,
            description=description,
        )
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='create_department',
            target_type='department',
            target_public_id=department.public_id,
            payload={'code': code, 'name': name},
        )
    return department


def _set_active(
    target,
    is_active,
    *,
    actor,
    source,
    actor_identifier,
    target_type,
    affected_user_ids,
):
    with transaction.atomic():
        target = type(target).objects.select_for_update().get(pk=target.pk)
        if target.is_active == is_active:
            return target
        before = target.is_active
        target.is_active = is_active
        target.save(update_fields=['is_active', 'updated_at'])

        reassigned_user_public_ids = []
        users = (
            AdminMembership.objects.filter(user_id__in=affected_user_ids)
            .select_related('user')
            .values_list('user_id', 'user__public_id')
            .distinct()
        )
        for user_id, public_id in users:
            user = AdminMembership.objects.filter(user_id=user_id).first().user
            before_primary = AdminMembership.objects.filter(
                user=user, is_active=True, is_primary=True
            ).first()
            after_primary = _reevaluate_primary(user)
            if (before_primary.pk if before_primary else None) != (
                after_primary.pk if after_primary else None
            ):
                reassigned_user_public_ids.append(public_id)

        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action=f'set_{target_type}_active',
            target_type=target_type,
            target_public_id=target.public_id,
            payload={
                'target': str(target),
                'before': {'is_active': before},
                'after': {'is_active': is_active},
                'primary_reassigned_user_public_ids': sorted(reassigned_user_public_ids),
            },
        )
        _schedule_cache_bust(affected_user_ids)
    return target


def set_role_active(
    role,
    is_active,
    *,
    actor,
    source='api',
    actor_identifier='',
):
    return _set_active(
        role,
        is_active,
        actor=actor,
        source=source,
        actor_identifier=actor_identifier,
        target_type='role',
        affected_user_ids=users_affected_by_role(role),
    )


def set_department_active(
    department,
    is_active,
    *,
    actor,
    source='api',
    actor_identifier='',
):
    return _set_active(
        department,
        is_active,
        actor=actor,
        source=source,
        actor_identifier=actor_identifier,
        target_type='department',
        affected_user_ids=users_affected_by_department(department),
    )
