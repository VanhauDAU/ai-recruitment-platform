"""Transactional administrator-access use cases."""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from ..admin_access_cache import bust_admin_permission_cache
from ..admin_access_rules import (
    StaleImpactToken,
    decode_impact_token,
)
from ..constants import (
    ADMIN_PERMISSIONS,
    system_department_definition,
    system_role_definition,
)
from ..models import (
    AdminAccessAuditLog,
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
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


def record_admin_self_action(user, action, payload=None):
    """Ghi nhật ký thao tác bảo mật do chính quản trị viên thực hiện.

    Gọi được từ các view dùng chung cho mọi cổng: no-op với tài khoản không phải
    admin nên không làm phình bảng audit bằng hoạt động của ứng viên/NTD.
    Payload chỉ chứa metadata không nhạy cảm (không mật khẩu, mã, token).
    """
    if not user or not user.is_authenticated or not user.is_admin_role:
        return None
    return _audit(
        actor=user,
        source='api',
        actor_identifier=user.email,
        action=action,
        target_type='user',
        target_public_id=user.public_id,
        payload=payload or {},
    )


def record_admin_action(
    *,
    actor,
    action,
    target_type,
    target_public_id,
    payload=None,
    source='api',
    actor_identifier='',
):
    """Public audit boundary for other account-domain services."""

    return _audit(
        actor=actor,
        source=source,
        actor_identifier=actor_identifier or (actor.email if actor else ''),
        action=action,
        target_type=target_type,
        target_public_id=target_public_id,
        payload=payload or {},
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
    chosen = active_memberships[0] if active_memberships else None

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
    actor_identifier='',
):
    if not user.is_admin_role:
        raise ValidationError('Membership chỉ được gán cho tài khoản admin.')
    if not role.is_active or not role.department.is_active:
        raise ValidationError('Không thể gán chức danh hoặc phòng ban đang bị khoá.')

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        role = AdminRole.objects.select_for_update().select_related('department').get(pk=role.pk)
        if not role.is_active or not role.department.is_active:
            raise ValidationError('Không thể gán chức danh hoặc phòng ban đang bị khoá.')
        if not role.permissions.filter(is_active=True).exists():
            raise ValidationError('Không thể gán nhân viên vào chức danh chưa có quyền hiệu lực.')
        locked = list(
            AdminMembership.objects.select_for_update()
            .select_related('role__department')
            .filter(user=user, is_active=True)
            .order_by('id')
        )
        if len(locked) == 1 and locked[0].role_id == role.pk:
            raise ValidationError('Nhân viên đã được gán chức danh này.')

        now = timezone.now()
        replaced = [
            {
                'membership_public_id': item.public_id,
                'department': item.role.department.code,
                'role': item.role.code,
            }
            for item in locked
        ]
        if locked:
            AdminMembership.objects.filter(pk__in=[item.pk for item in locked]).update(
                is_active=False,
                is_primary=False,
                revoked_by=actor,
                revoked_at=now,
            )
        membership = AdminMembership(
            user=user,
            role=role,
            assigned_by=actor,
            is_primary=True,
        )
        membership.full_clean()
        membership.save()
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='replace_membership' if replaced else 'assign_membership',
            target_type='membership',
            target_public_id=membership.public_id,
            payload={
                'membership_public_id': membership.public_id,
                'department': role.department.code,
                'role': role.code,
                'user_public_id': user.public_id,
                'replaced_memberships': replaced,
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
            },
        )
        _schedule_cache_bust({membership.user_id})
    return membership


def set_role_permissions(
    role,
    desired_active_codes,
    *,
    actor,
    source='api',
    preserve_deprecated=True,
    mark_customized=False,
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
        if not desired_codes and role.memberships.filter(is_active=True).exists():
            raise ValidationError(
                {
                    'permission_codes': (
                        'Không thể xoá toàn bộ quyền của chức danh đang có nhân viên hoạt động.'
                    )
                }
            )

        affected_user_ids = users_affected_by_role(role)
        before_system_managed = role.is_system_managed
        if mark_customized and role.is_system_managed:
            role.is_system_managed = False
            role.save(update_fields=['is_system_managed', 'updated_at'])
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
                'before': {
                    'permission_codes': sorted(before),
                    'is_system_managed': before_system_managed,
                },
                'after': {
                    'permission_codes': sorted(final),
                    'is_system_managed': role.is_system_managed,
                },
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
        if Department.objects.filter(code=code).exists():
            raise ValidationError({'code': 'Mã phòng ban đã tồn tại.'})
        try:
            with transaction.atomic():
                department = Department.objects.create(
                    code=code,
                    name=name,
                    description=description,
                    is_system_managed=False,
                )
        except IntegrityError as error:
            raise ValidationError({'code': 'Mã phòng ban đã tồn tại.'}) from error
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


def update_department(
    department,
    *,
    name,
    description,
    actor,
    source='api',
    actor_identifier='',
):
    with transaction.atomic():
        department = Department.objects.select_for_update().get(pk=department.pk)
        before = {
            'name': department.name,
            'description': department.description,
            'is_system_managed': department.is_system_managed,
        }
        if department.name == name and department.description == description:
            return department
        department.name = name
        department.description = description
        department.is_system_managed = False
        department.save(update_fields=['name', 'description', 'is_system_managed', 'updated_at'])
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='update_department',
            target_type='department',
            target_public_id=department.public_id,
            payload={
                'before': before,
                'after': {
                    'name': department.name,
                    'description': department.description,
                    'is_system_managed': department.is_system_managed,
                },
            },
        )
    return department


def create_role(
    department,
    *,
    code,
    name,
    description='',
    rank=0,
    actor,
    source='api',
    actor_identifier='',
):
    with transaction.atomic():
        department = Department.objects.select_for_update().get(pk=department.pk)
        if AdminRole.objects.filter(department=department, code=code).exists():
            raise ValidationError({'code': 'Mã chức danh đã tồn tại trong phòng ban.'})
        try:
            with transaction.atomic():
                role = AdminRole.objects.create(
                    department=department,
                    code=code,
                    name=name,
                    description=description,
                    rank=rank,
                    is_system_managed=False,
                )
        except IntegrityError as error:
            raise ValidationError({'code': 'Mã chức danh đã tồn tại trong phòng ban.'}) from error
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='create_role',
            target_type='role',
            target_public_id=role.public_id,
            payload={
                'department': department.code,
                'code': role.code,
                'name': role.name,
                'rank': role.rank,
            },
        )
    return role


def update_role(
    role,
    *,
    name,
    description,
    rank,
    actor,
    source='api',
    actor_identifier='',
):
    with transaction.atomic():
        role = AdminRole.objects.select_for_update().get(pk=role.pk)
        before = {
            'name': role.name,
            'description': role.description,
            'rank': role.rank,
            'is_system_managed': role.is_system_managed,
        }
        if role.name == name and role.description == description and role.rank == rank:
            return role
        role.name = name
        role.description = description
        role.rank = rank
        role.is_system_managed = False
        role.save(
            update_fields=[
                'name',
                'description',
                'rank',
                'is_system_managed',
                'updated_at',
            ]
        )
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='update_role',
            target_type='role',
            target_public_id=role.public_id,
            payload={
                'before': before,
                'after': {
                    'name': role.name,
                    'description': role.description,
                    'rank': role.rank,
                    'is_system_managed': role.is_system_managed,
                },
            },
        )
    return role


def update_system_department_metadata(
    department,
    *,
    name,
    description,
    actor=None,
    source='seed',
    actor_identifier='',
):
    with transaction.atomic():
        department = Department.objects.select_for_update().get(pk=department.pk)
        before = {'name': department.name, 'description': department.description}
        if before == {'name': name, 'description': description}:
            return department
        department.name = name
        department.description = description
        department.save(update_fields=['name', 'description', 'updated_at'])
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='sync_system_department_metadata',
            target_type='department',
            target_public_id=department.public_id,
            payload={'before': before, 'after': {'name': name, 'description': description}},
        )
    return department


def update_system_role_metadata(
    role,
    *,
    name,
    description,
    rank,
    actor=None,
    source='seed',
    actor_identifier='',
):
    with transaction.atomic():
        role = AdminRole.objects.select_for_update().get(pk=role.pk)
        before = {'name': role.name, 'description': role.description, 'rank': role.rank}
        after = {'name': name, 'description': description, 'rank': rank}
        if before == after:
            return role
        role.name = name
        role.description = description
        role.rank = rank
        role.save(update_fields=['name', 'description', 'rank', 'updated_at'])
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='sync_system_role_metadata',
            target_type='role',
            target_public_id=role.public_id,
            payload={'before': before, 'after': after},
        )
    return role


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
        users = User.objects.filter(pk__in=affected_user_ids).only('id', 'public_id')
        for user in users:
            before_primary = AdminMembership.objects.filter(
                user=user, is_active=True, is_primary=True
            ).first()
            after_primary = _reevaluate_primary(user)
            if (before_primary.pk if before_primary else None) != (
                after_primary.pk if after_primary else None
            ):
                reassigned_user_public_ids.append(user.public_id)

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


def restore_system_department(
    department,
    *,
    actor,
    source='api',
    actor_identifier='',
):
    definition = system_department_definition(department.code)
    if definition is None:
        raise ValidationError('Phòng ban này không có cấu hình mặc định hệ thống.')
    with transaction.atomic():
        department = Department.objects.select_for_update().get(pk=department.pk)
        before = {
            'name': department.name,
            'description': department.description,
            'is_system_managed': department.is_system_managed,
        }
        after = {
            'name': definition['name'],
            'description': definition['description'],
            'is_system_managed': True,
        }
        if before == after:
            return department
        department.name = definition['name']
        department.description = definition['description']
        department.is_system_managed = True
        department.save(update_fields=['name', 'description', 'is_system_managed', 'updated_at'])
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='restore_system_department',
            target_type='department',
            target_public_id=department.public_id,
            payload={'before': before, 'after': after},
        )
    return department


def restore_system_role(
    role,
    *,
    actor,
    source='api',
    actor_identifier='',
):
    definition = system_role_definition(role.department.code, role.code)
    if definition is None:
        raise ValidationError('Chức danh này không có cấu hình mặc định hệ thống.')
    with transaction.atomic():
        role = AdminRole.objects.select_for_update().select_related('department').get(pk=role.pk)
        before_permissions = {item.code: item for item in role.permissions.all()}
        desired_codes = set(definition['permissions'])
        desired = {
            item.code: item
            for item in AdminPermission.objects.filter(
                code__in=desired_codes,
                is_active=True,
            )
        }
        deprecated = {code: item for code, item in before_permissions.items() if not item.is_active}
        final_permissions = {**desired, **deprecated}
        before = {
            'name': role.name,
            'description': role.description,
            'rank': role.rank,
            'permission_codes': sorted(before_permissions),
            'is_system_managed': role.is_system_managed,
        }
        after = {
            'name': definition['name'],
            'description': definition.get('description', ''),
            'rank': definition['rank'],
            'permission_codes': sorted(final_permissions),
            'is_system_managed': True,
        }
        if before == after:
            return role

        permissions_changed = set(before_permissions) != set(final_permissions)
        affected_user_ids = users_affected_by_role(role) if permissions_changed else set()
        role.name = definition['name']
        role.description = definition.get('description', '')
        role.rank = definition['rank']
        role.is_system_managed = True
        role.save(
            update_fields=[
                'name',
                'description',
                'rank',
                'is_system_managed',
                'updated_at',
            ]
        )
        if permissions_changed:
            role.permissions.set(final_permissions.values())
        _audit(
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            action='restore_system_role',
            target_type='role',
            target_public_id=role.public_id,
            payload={'before': before, 'after': after},
        )
        if permissions_changed:
            _schedule_cache_bust(affected_user_ids)
    return role


def _current_rbac_revision():
    return AdminAccessAuditLog.objects.aggregate(value=Max('id'))['value'] or 0


def _assert_current_revision(claims):
    if _current_rbac_revision() != claims['revision']:
        raise StaleImpactToken('Dữ liệu phân quyền đã thay đổi.')


def _lock_role_dependencies(role):
    role = AdminRole.objects.select_for_update().select_related('department').get(pk=role.pk)
    Department.objects.select_for_update().filter(pk=role.department_id).exists()
    through = AdminRole.permissions.through
    list(through.objects.select_for_update().filter(adminrole_id=role.pk))
    member_user_ids = set(
        AdminMembership.objects.select_for_update()
        .filter(role=role, is_active=True)
        .values_list('user_id', flat=True)
    )
    if member_user_ids:
        list(
            AdminMembership.objects.select_for_update()
            .filter(user_id__in=member_user_ids)
            .order_by('id')
        )
    return role


def confirm_department_status_change(
    department,
    is_active,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    payload = {'is_active': bool(is_active)}
    claims = decode_impact_token(
        impact_token,
        operation='department.status.change',
        resource_key=f'department:{department.public_id}',
        normalized_payload=payload,
    )
    with transaction.atomic():
        department = Department.objects.select_for_update().get(pk=department.pk)
        role_ids = list(
            AdminRole.objects.select_for_update()
            .filter(department=department)
            .values_list('id', flat=True)
        )
        user_ids = set(
            AdminMembership.objects.select_for_update()
            .filter(role_id__in=role_ids, is_active=True)
            .values_list('user_id', flat=True)
        )
        if user_ids:
            list(
                AdminMembership.objects.select_for_update()
                .filter(user_id__in=user_ids)
                .order_by('id')
            )
        _assert_current_revision(claims)
        return set_department_active(
            department,
            is_active,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
        )


def confirm_role_status_change(
    role,
    is_active,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    payload = {'is_active': bool(is_active)}
    claims = decode_impact_token(
        impact_token,
        operation='role.status.change',
        resource_key=f'role:{role.public_id}',
        normalized_payload=payload,
    )
    with transaction.atomic():
        role = _lock_role_dependencies(role)
        _assert_current_revision(claims)
        return set_role_active(
            role,
            is_active,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
        )


def confirm_role_permissions_update(
    role,
    permission_codes,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    codes = sorted(set(permission_codes))
    claims = decode_impact_token(
        impact_token,
        operation='role.permissions.update',
        resource_key=f'role:{role.public_id}',
        normalized_payload={'permission_codes': codes},
    )
    with transaction.atomic():
        role = _lock_role_dependencies(role)
        _assert_current_revision(claims)
        return set_role_permissions(
            role,
            codes,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
            preserve_deprecated=True,
            mark_customized=True,
        )


def confirm_membership_assignment(
    user,
    role,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    payload = {
        'user_public_id': user.public_id,
        'role_public_id': role.public_id,
    }
    claims = decode_impact_token(
        impact_token,
        operation='membership.assign',
        resource_key=f'membership-assignment:{user.public_id}:{role.public_id}',
        normalized_payload=payload,
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        role = AdminRole.objects.select_for_update().select_related('department').get(pk=role.pk)
        Department.objects.select_for_update().filter(pk=role.department_id).exists()
        list(
            AdminMembership.objects.select_for_update()
            .filter(user=user, is_active=True)
            .order_by('id')
        )
        _assert_current_revision(claims)
        return assign_membership(
            user,
            role,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
        )


def confirm_membership_revoke(
    membership,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    claims = decode_impact_token(
        impact_token,
        operation='membership.revoke',
        resource_key=f'membership:{membership.public_id}',
        normalized_payload={},
    )
    with transaction.atomic():
        membership = (
            AdminMembership.objects.select_for_update().select_related('user').get(pk=membership.pk)
        )
        User.objects.select_for_update().filter(pk=membership.user_id).exists()
        list(
            AdminMembership.objects.select_for_update()
            .filter(user_id=membership.user_id, is_active=True)
            .order_by('id')
        )
        _assert_current_revision(claims)
        return revoke_membership(
            membership,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
        )


def confirm_restore_system_role(
    role,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    claims = decode_impact_token(
        impact_token,
        operation='role.restore',
        resource_key=f'role:{role.public_id}',
        normalized_payload={},
    )
    with transaction.atomic():
        role = _lock_role_dependencies(role)
        _assert_current_revision(claims)
        return restore_system_role(
            role,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
        )


def confirm_restore_system_department(
    department,
    *,
    impact_token,
    actor,
    source='api',
    actor_identifier='',
):
    claims = decode_impact_token(
        impact_token,
        operation='department.restore',
        resource_key=f'department:{department.public_id}',
        normalized_payload={},
    )
    with transaction.atomic():
        department = Department.objects.select_for_update().get(pk=department.pk)
        _assert_current_revision(claims)
        return restore_system_department(
            department,
            actor=actor,
            source=source,
            actor_identifier=actor_identifier,
        )
