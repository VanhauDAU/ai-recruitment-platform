"""Low-level cache operations shared by RBAC readers and writers."""

from django.core.cache import cache

ADMIN_PERMISSION_CACHE_TTL = 60
_CACHE_PREFIX = 'admin_perms:'


def admin_permission_cache_key(user_id):
    return f'{_CACHE_PREFIX}{user_id}'


def bust_admin_permission_cache(user_ids):
    keys = [admin_permission_cache_key(user_id) for user_id in set(user_ids)]
    if not keys:
        return
    try:
        cache.delete_many(keys)
    except Exception:
        # Cache failure cannot change the authorization decision. The short TTL
        # remains a final recovery mechanism after the backend is healthy.
        pass
