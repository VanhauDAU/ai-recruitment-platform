from unittest.mock import patch

from django.test import SimpleTestCase

from apps.knowledgebase.services import (
    invalidate_knowledge_public_cache,
    knowledge_public_cache_version,
)


class KnowledgebaseCacheFailSafeTests(SimpleTestCase):
    @patch('apps.knowledgebase.services.cache.cache.get', side_effect=RuntimeError('cache down'))
    def test_public_reads_fall_back_to_default_generation_when_cache_is_down(self, _cache_get):
        self.assertEqual(knowledge_public_cache_version(), 1)

    @patch('apps.knowledgebase.services.cache.cache.incr', side_effect=RuntimeError('cache down'))
    def test_editorial_write_invalidation_is_best_effort(self, _cache_incr):
        self.assertEqual(invalidate_knowledge_public_cache(), 1)
