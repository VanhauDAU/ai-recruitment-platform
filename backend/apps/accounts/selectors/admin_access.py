"""Read models for administrator access control."""

from django.core.cache import cache
from django.db.models import Count, Max, Prefetch, Q

from ..admin_access_cache import ADMIN_PERMISSION_CACHE_TTL, admin_permission_cache_key
from ..admin_access_rules import create_impact_token, select_primary_successor
from ..constants import (
    ADMIN_PERMISSION_CODES,
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

IMPACT_PREVIEW_LIMIT = 20


def _permissions_from_database(user):
    return frozenset(
        AdminPermission.objects.filter(
            is_active=True,
            roles__is_active=True,
            roles__department__is_active=True,
            roles__memberships__user=user,
            roles__memberships__is_active=True,
        )
        .values_list('code', flat=True)
        .distinct()
    )


def effective_permission_codes(user) -> frozenset[str]:
    if not user or not user.is_authenticated or not user.is_admin_role:
        return frozenset()
    if user.is_superuser:
        # A superuser bypass is code-owned and remains usable before the first
        # catalog sync during a deployment.
        return ADMIN_PERMISSION_CODES

    key = admin_permission_cache_key(user.pk)
    try:
        cached = cache.get(key)
    except Exception:
        cached = None
    if cached is not None:
        return frozenset(cached)

    permissions = _permissions_from_database(user)
    try:
        cache.set(key, sorted(permissions), min(ADMIN_PERMISSION_CACHE_TTL, 300))
    except Exception:
        # Redis availability must never turn a denied request into an allowed one.
        pass
    return permissions


def admin_access_snapshot(user):
    if not user or not user.is_authenticated or not user.is_admin_role:
        return None

    memberships = list(
        AdminMembership.objects.filter(
            user=user,
            is_active=True,
            role__is_active=True,
            role__department__is_active=True,
        )
        .select_related('role__department')
        .order_by('-is_primary', '-role__rank', 'assigned_at', 'id')
    )
    primary = next((item for item in memberships if item.is_primary), None)
    return {
        'is_superuser': bool(user.is_superuser),
        'permissions': sorted(effective_permission_codes(user)),
        'primary_department': (
            {
                'code': primary.role.department.code,
                'name': primary.role.department.name,
            }
            if primary
            else None
        ),
        'memberships': [
            {
                'department': {
                    'code': membership.role.department.code,
                    'name': membership.role.department.name,
                },
                'role': {
                    'code': membership.role.code,
                    'name': membership.role.name,
                    'rank': membership.role.rank,
                },
            }
            for membership in memberships
        ],
    }


def current_rbac_revision():
    return AdminAccessAuditLog.objects.aggregate(value=Max('id'))['value'] or 0


def departments_queryset():
    return Department.objects.annotate(
        role_count=Count('roles', distinct=True),
        active_member_count=Count(
            'roles__memberships',
            filter=Q(roles__memberships__is_active=True),
            distinct=True,
        ),
        revoked_member_count=Count(
            'roles__memberships',
            filter=Q(roles__memberships__is_active=False),
            distinct=True,
        ),
    ).order_by('name', 'code')


def roles_queryset(*, department_code=None):
    queryset = (
        AdminRole.objects.select_related('department')
        .prefetch_related('permissions')
        .annotate(
            active_member_count=Count(
                'memberships',
                filter=Q(memberships__is_active=True),
                distinct=True,
            )
        )
        .order_by('department__name', '-rank', 'name')
    )
    if department_code:
        queryset = queryset.filter(department__code=department_code)
    return queryset


def memberships_queryset(
    *,
    department_code=None,
    user_public_id=None,
    include_revoked=False,
):
    queryset = AdminMembership.objects.select_related(
        'user',
        'role__department',
        'assigned_by',
        'revoked_by',
    ).order_by('-is_primary', '-role__rank', 'assigned_at', 'id')
    if not include_revoked:
        queryset = queryset.filter(is_active=True)
    if department_code:
        queryset = queryset.filter(role__department__code=department_code)
    if user_public_id:
        queryset = queryset.filter(user__public_id=user_public_id)
    return queryset


def admin_staff_queryset(*, query=''):
    queryset = (
        User.objects.filter(
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_deleted=False,
        )
        .annotate(
            active_membership_count=Count(
                'admin_memberships',
                filter=Q(admin_memberships__is_active=True),
                distinct=True,
            )
        )
        .order_by('email', 'id')
    )
    if query:
        queryset = queryset.filter(Q(email__icontains=query) | Q(full_name__icontains=query))
    return queryset


def permissions_queryset(*, role=None):
    queryset = AdminPermission.objects.all().order_by('module', 'code')
    if role is not None:
        granted_ids = role.permissions.values_list('id', flat=True)
        return queryset.annotate(
            is_granted_to_role=Q(pk__in=granted_ids),
        )
    return queryset


def _impact_memberships(user_ids):
    active_permissions = Prefetch(
        'role__permissions',
        queryset=AdminPermission.objects.filter(is_active=True).only('id', 'code'),
        to_attr='_impact_active_permissions',
    )
    memberships = list(
        AdminMembership.objects.filter(user_id__in=user_ids, is_active=True)
        .select_related('user', 'role__department')
        .prefetch_related(active_permissions)
        .order_by('assigned_at', 'id')
    )
    grouped = {user_id: [] for user_id in user_ids}
    for membership in memberships:
        grouped.setdefault(membership.user_id, []).append(membership)
    return grouped


def _membership_is_valid(
    membership,
    *,
    role_active_overrides=None,
    department_active_overrides=None,
    excluded_membership_ids=frozenset(),
):
    if membership.pk in excluded_membership_ids:
        return False
    role_active = (role_active_overrides or {}).get(
        membership.role_id,
        membership.role.is_active,
    )
    department_active = (department_active_overrides or {}).get(
        membership.role.department_id,
        membership.role.department.is_active,
    )
    return membership.is_active and role_active and department_active


def _effective_codes(
    memberships,
    *,
    role_permission_overrides=None,
    role_active_overrides=None,
    department_active_overrides=None,
    excluded_membership_ids=frozenset(),
):
    codes = set()
    for membership in memberships:
        if not _membership_is_valid(
            membership,
            role_active_overrides=role_active_overrides,
            department_active_overrides=department_active_overrides,
            excluded_membership_ids=excluded_membership_ids,
        ):
            continue
        override = (role_permission_overrides or {}).get(membership.role_id)
        if override is not None:
            codes.update(override)
        else:
            codes.update(
                permission.code for permission in membership.role._impact_active_permissions
            )
    return codes


def _primary_membership(
    memberships,
    *,
    role_active_overrides=None,
    department_active_overrides=None,
    excluded_membership_ids=frozenset(),
    force_membership=None,
):
    valid = [
        membership
        for membership in memberships
        if _membership_is_valid(
            membership,
            role_active_overrides=role_active_overrides,
            department_active_overrides=department_active_overrides,
            excluded_membership_ids=excluded_membership_ids,
        )
    ]
    if force_membership is not None and force_membership in valid:
        return force_membership
    current = next((item for item in valid if item.is_primary), None)
    return current or select_primary_successor(valid)


def _department_summary(department):
    if department is None:
        return None
    return {'code': department.code, 'name': department.name}


def _user_summary(user):
    return {
        'public_id': user.public_id,
        'email': user.email,
        'full_name': user.full_name,
    }


def _finish_affected_preview(result, affected):
    result['affected_user_count'] = len(affected)
    result['affected_users_preview'] = affected[:IMPACT_PREVIEW_LIMIT]
    result['preview_limit'] = IMPACT_PREVIEW_LIMIT
    result['has_more'] = len(affected) > IMPACT_PREVIEW_LIMIT
    return result


def department_status_impact(department, *, is_active):
    scoped = AdminMembership.objects.filter(
        role__department=department,
        role__is_active=True,
        is_active=True,
    )
    active_membership_count = scoped.count()
    primary_membership_count = scoped.filter(is_primary=True).count()
    user_ids = set(scoped.values_list('user_id', flat=True))
    grouped = _impact_memberships(user_ids)
    affected = []
    for memberships in grouped.values():
        if not memberships:
            continue
        before = _effective_codes(memberships)
        after = _effective_codes(
            memberships,
            department_active_overrides={department.pk: bool(is_active)},
        )
        if before == after:
            continue
        user = memberships[0].user
        current = _primary_membership(memberships)
        next_primary = _primary_membership(
            memberships,
            department_active_overrides={department.pk: bool(is_active)},
        )
        item = {
            **_user_summary(user),
            'currently_primary': bool(current and current.role.department_id == department.pk),
            'next_primary_department': (
                _department_summary(next_primary.role.department) if next_primary else None
            ),
            'permissions_gained': sorted(after - before),
            'permissions_lost': sorted(before - after),
        }
        affected.append(item)
    affected.sort(key=lambda item: item['email'])
    result = {
        'desired_state': 'active' if is_active else 'inactive',
        'department': {
            'public_id': department.public_id,
            'code': department.code,
            'name': department.name,
        },
        'active_membership_count': active_membership_count,
        'primary_membership_count': primary_membership_count,
        'effective_users_changed_count': len(affected),
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='department.status.change',
            resource_key=f'department:{department.public_id}',
            normalized_payload={'is_active': bool(is_active)},
        ),
    }
    return _finish_affected_preview(result, affected)


def role_status_impact(role, *, is_active):
    scoped = AdminMembership.objects.filter(role=role, is_active=True)
    if not role.department.is_active:
        scoped = scoped.none()
    active_membership_count = scoped.count()
    primary_membership_count = scoped.filter(is_primary=True).count()
    user_ids = set(scoped.values_list('user_id', flat=True))
    grouped = _impact_memberships(user_ids)
    affected = []
    for memberships in grouped.values():
        if not memberships:
            continue
        before = _effective_codes(memberships)
        after = _effective_codes(
            memberships,
            role_active_overrides={role.pk: bool(is_active)},
        )
        if before == after:
            continue
        user = memberships[0].user
        current = _primary_membership(memberships)
        next_primary = _primary_membership(
            memberships,
            role_active_overrides={role.pk: bool(is_active)},
        )
        affected.append(
            {
                **_user_summary(user),
                'currently_primary': bool(current and current.role_id == role.pk),
                'next_primary_department': (
                    _department_summary(next_primary.role.department) if next_primary else None
                ),
                'permissions_gained': sorted(after - before),
                'permissions_lost': sorted(before - after),
            }
        )
    affected.sort(key=lambda item: item['email'])
    result = {
        'desired_state': 'active' if is_active else 'inactive',
        'role': {
            'public_id': role.public_id,
            'code': role.code,
            'name': role.name,
        },
        'department': _department_summary(role.department),
        'active_membership_count': active_membership_count,
        'primary_membership_count': primary_membership_count,
        'effective_users_changed_count': len(affected),
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='role.status.change',
            resource_key=f'role:{role.public_id}',
            normalized_payload={'is_active': bool(is_active)},
        ),
    }
    return _finish_affected_preview(result, affected)


def role_permissions_impact(role, *, permission_codes):
    desired_codes = set(permission_codes)
    before_codes = set(role.permissions.filter(is_active=True).values_list('code', flat=True))
    scoped = AdminMembership.objects.filter(role=role, is_active=True)
    if not role.is_active or not role.department.is_active:
        scoped = scoped.none()
    active_membership_count = scoped.count()
    user_ids = set(scoped.values_list('user_id', flat=True))
    grouped = _impact_memberships(user_ids)
    affected = []
    for memberships in grouped.values():
        if not memberships:
            continue
        before = _effective_codes(memberships)
        after = _effective_codes(
            memberships,
            role_permission_overrides={role.pk: desired_codes},
        )
        if before == after:
            continue
        affected.append(
            {
                **_user_summary(memberships[0].user),
                'permissions_gained': sorted(after - before),
                'permissions_lost': sorted(before - after),
            }
        )
    affected.sort(key=lambda item: item['email'])
    can_apply = not (not desired_codes and active_membership_count)
    blocking_reason = (
        (
            'Không thể xoá toàn bộ quyền vì chức danh đang có '
            f'{active_membership_count} nhân viên hoạt động.'
        )
        if not can_apply
        else None
    )
    result = {
        'permissions_added': sorted(desired_codes - before_codes),
        'permissions_removed': sorted(before_codes - desired_codes),
        'active_membership_count': active_membership_count,
        'effective_users_changed_count': len(affected),
        'will_leave_system_management': bool(
            role.is_system_managed and before_codes != desired_codes
        ),
        'can_apply': can_apply,
        'blocking_reason': blocking_reason,
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='role.permissions.update',
            resource_key=f'role:{role.public_id}',
            normalized_payload={'permission_codes': sorted(desired_codes)},
        ),
    }
    return _finish_affected_preview(result, affected)


def membership_assignment_impact(user, role, *, is_primary):
    grouped = _impact_memberships({user.pk})
    memberships = grouped.get(user.pk, [])
    current_permissions = _effective_codes(memberships)
    role_permissions = set(role.permissions.filter(is_active=True).values_list('code', flat=True))
    current_primary = _primary_membership(memberships)
    make_primary = bool(is_primary) or current_primary is None
    next_department = (
        role.department
        if make_primary
        else (current_primary.role.department if current_primary else role.department)
    )
    payload = {
        'user_public_id': user.public_id,
        'role_public_id': role.public_id,
        'is_primary': bool(is_primary),
    }
    return {
        'user': {
            **_user_summary(user),
            'two_factor_enabled': user.two_factor_enabled,
        },
        'department': _department_summary(role.department),
        'role': {
            'public_id': role.public_id,
            'code': role.code,
            'name': role.name,
        },
        'permissions_gained': sorted(role_permissions - current_permissions),
        'permissions_already_available': sorted(role_permissions & current_permissions),
        'current_primary_department': (
            _department_summary(current_primary.role.department) if current_primary else None
        ),
        'next_primary_department': _department_summary(next_department),
        'mfa_warning': not user.two_factor_enabled,
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='membership.assign',
            resource_key=f'membership-assignment:{user.public_id}:{role.public_id}',
            normalized_payload=payload,
        ),
    }


def membership_revoke_impact(membership):
    grouped = _impact_memberships({membership.user_id})
    memberships = grouped.get(membership.user_id, [])
    before = _effective_codes(memberships)
    after = _effective_codes(
        memberships,
        excluded_membership_ids={membership.pk},
    )
    current_primary = _primary_membership(memberships)
    next_primary = _primary_membership(
        memberships,
        excluded_membership_ids={membership.pk},
    )
    return {
        'membership': membership.public_id,
        'user': _user_summary(membership.user),
        'department': _department_summary(membership.role.department),
        'role': {'code': membership.role.code, 'name': membership.role.name},
        'permissions_lost': sorted(before - after),
        'is_primary': bool(current_primary and current_primary.pk == membership.pk),
        'next_primary_department': (
            _department_summary(next_primary.role.department) if next_primary else None
        ),
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='membership.revoke',
            resource_key=f'membership:{membership.public_id}',
            normalized_payload={},
        ),
    }


def membership_set_primary_impact(membership):
    grouped = _impact_memberships({membership.user_id})
    memberships = grouped.get(membership.user_id, [])
    current = _primary_membership(memberships)
    return {
        'membership': membership.public_id,
        'user': _user_summary(membership.user),
        'current_primary_department': (
            _department_summary(current.role.department) if current else None
        ),
        'next_primary_department': _department_summary(membership.role.department),
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='membership.set_primary',
            resource_key=f'membership:{membership.public_id}',
            normalized_payload={},
        ),
    }


def restore_system_department_impact(department):
    definition = system_department_definition(department.code)
    if definition is None:
        return None
    changes = {}
    for field in ('name', 'description'):
        before = getattr(department, field)
        after = definition[field]
        if before != after:
            changes[field] = {'before': before, 'after': after}
    return {
        'metadata_changes': changes,
        'will_enter_system_management': not department.is_system_managed,
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='department.restore',
            resource_key=f'department:{department.public_id}',
            normalized_payload={},
        ),
    }


def restore_system_role_impact(role):
    definition = system_role_definition(role.department.code, role.code)
    if definition is None:
        return None
    available_default_codes = set(
        AdminPermission.objects.filter(
            code__in=definition['permissions'],
            is_active=True,
        ).values_list('code', flat=True)
    )
    impact = role_permissions_impact(
        role,
        permission_codes=available_default_codes,
    )
    changes = {}
    for field in ('name', 'description', 'rank'):
        before = getattr(role, field)
        after = definition.get(field, '' if field == 'description' else before)
        if before != after:
            changes[field] = {'before': before, 'after': after}
    impact['metadata_changes'] = changes
    impact['will_enter_system_management'] = not role.is_system_managed
    impact['impact_token'] = create_impact_token(
        revision=current_rbac_revision(),
        operation='role.restore',
        resource_key=f'role:{role.public_id}',
        normalized_payload={},
    )
    return impact
