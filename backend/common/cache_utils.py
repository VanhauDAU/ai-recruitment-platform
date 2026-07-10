"""Cache helpers for security-sensitive, single-use tokens."""

from django.core.cache import cache


_ATOMIC_POP_SCRIPT = """
local value = redis.call('GET', KEYS[1])
if value then
    redis.call('DEL', KEYS[1])
end
return value
"""


def atomic_pop(key):
    """Read and delete a cache key exactly once.

    The production django-redis backend uses Lua so concurrent requests cannot
    consume the same token. Local Django cache backends remain supported for
    tests and development, where cross-process atomicity is not relevant.
    """
    client = getattr(cache, 'client', None)
    get_client = getattr(client, 'get_client', None)
    decode = getattr(client, 'decode', None)

    if get_client and decode:
        raw = get_client(write=True).eval(_ATOMIC_POP_SCRIPT, 1, cache.make_key(key))
        return decode(raw) if raw is not None else None

    value = cache.get(key)
    if value is not None:
        cache.delete(key)
    return value
