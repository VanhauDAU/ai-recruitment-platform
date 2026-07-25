"""Read models for administrator access control."""

from django.core.cache import cache

from ..admin_access_cache import ADMIN_PERMISSION_CACHE_TTL, admin_permission_cache_key
from ..constants import ADMIN_PERMISSION_CODES
from ..models import AdminMembership, AdminPermission


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
