"""Small cache generation used by conditional public responses."""

from django.core.cache import cache

PUBLIC_CACHE_VERSION_KEY = 'knowledgebase:public:generation'


def knowledge_public_cache_version():
    try:
        return int(cache.get(PUBLIC_CACHE_VERSION_KEY, 1))
    except Exception:  # noqa: BLE001 -- cache outage must not take public reads down.
        return 1


def invalidate_knowledge_public_cache():
    try:
        return cache.incr(PUBLIC_CACHE_VERSION_KEY)
    except ValueError:
        try:
            cache.set(PUBLIC_CACHE_VERSION_KEY, 2, timeout=None)
            return 2
        except Exception:  # noqa: BLE001 -- invalidation is best effort, DB is canonical.
            return 1
    except Exception:  # noqa: BLE001 -- cache outage cannot block editorial writes.
        return 1
