"""Small cache generation used by conditional public responses."""

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

PUBLIC_CACHE_VERSION_KEY = 'knowledgebase:public:generation'


def knowledge_public_cache_version():
    try:
        return int(cache.get(PUBLIC_CACHE_VERSION_KEY, 1))
    except Exception:  # noqa: BLE001 -- cache outage must not take public reads down.
        logger.warning('Knowledgebase cache generation unavailable; using generation 1.')
        return 1


def invalidate_knowledge_public_cache():
    try:
        return cache.incr(PUBLIC_CACHE_VERSION_KEY)
    except ValueError:
        # incr() raises ValueError when the key has never been set (or expired).
        try:
            cache.set(PUBLIC_CACHE_VERSION_KEY, 2, timeout=None)
            return 2
        except Exception:  # noqa: BLE001 -- invalidation is best effort, DB is canonical.
            logger.warning('Knowledgebase cache generation could not be initialised.')
            return 1
    except Exception:  # noqa: BLE001 -- cache outage cannot block editorial writes.
        logger.warning('Knowledgebase cache invalidation skipped: cache unavailable.')
        return 1
