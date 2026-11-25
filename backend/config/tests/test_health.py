from unittest.mock import patch

from django.test import TestCase

from config import health


def _fail():
    raise ConnectionError('redis://secret-host:6379 refused')


class ReadinessCheckTests(TestCase):
    def test_liveness_touches_no_dependency(self):
        with patch.dict(health.READINESS_CHECKS, {'database': _fail}):
            response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_ready_when_every_dependency_answers(self):
        with patch.object(health, '_ping_redis') as ping:
            response = self.client.get('/api/health/ready/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {'status': 'ok', 'checks': {'database': 'ok', 'cache': 'ok', 'broker': 'ok'}},
        )
        # Bộ test dùng cache locmem nên chỉ broker đi qua ping Redis thật.
        ping.assert_called_once()
        self.assertIn('no-cache', response['Cache-Control'])

    def test_failed_dependency_returns_503_without_leaking_details(self):
        with (
            patch.object(health, '_ping_redis'),
            patch.dict(health.READINESS_CHECKS, {'broker': _fail}),
            self.assertLogs('config.health', level='WARNING'),
        ):
            response = self.client.get('/api/health/ready/')

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['checks']['broker'], 'error')
        self.assertEqual(response.json()['checks']['database'], 'ok')
        self.assertNotIn(b'secret-host', response.content)

    def test_redis_cache_backend_is_pinged_with_its_own_url(self):
        caches = {
            'default': {
                'BACKEND': 'django_redis.cache.RedisCache',
                'LOCATION': 'redis://redis-cache:6379/0',
            }
        }
        with self.settings(CACHES=caches), patch.object(health, '_ping_redis') as ping:
            health._check_cache()

        ping.assert_called_once_with('redis://redis-cache:6379/0')
