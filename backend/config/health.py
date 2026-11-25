"""Kiểm tra sức khỏe cho healthcheck của compose, deploy.sh và UptimeRobot.

- ``/api/health/``: liveness, không chạm phụ thuộc nào (process còn trả lời).
- ``/api/health/ready/``: readiness, kiểm DB + Redis cache + Redis broker với
  timeout ngắn; một phụ thuộc lỗi thì 503. Body chỉ có tên phụ thuộc và
  ``ok``/``error`` — không lộ hostname, URL hay nội dung lỗi (chi tiết ở log).
"""

import logging

import redis
from django.conf import settings
from django.core.cache import caches
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache

logger = logging.getLogger(__name__)

# Tổng ba lần kiểm phải nằm gọn trong timeout 5 giây của healthcheck compose.
REDIS_PING_TIMEOUT_SECONDS = 1


def _check_database():
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')


def _ping_redis(url):
    client = redis.Redis.from_url(
        url,
        socket_connect_timeout=REDIS_PING_TIMEOUT_SECONDS,
        socket_timeout=REDIS_PING_TIMEOUT_SECONDS,
    )
    try:
        client.ping()
    finally:
        client.close()


def _check_cache():
    cache_config = settings.CACHES['default']
    if cache_config['BACKEND'].startswith('django_redis.'):
        _ping_redis(cache_config['LOCATION'])
    else:
        caches['default'].get('health:ready')


def _check_broker():
    _ping_redis(settings.CELERY_BROKER_URL)


READINESS_CHECKS = {
    'database': _check_database,
    'cache': _check_cache,
    'broker': _check_broker,
}


@never_cache
def health_check(request):
    return JsonResponse({'status': 'ok'})


@never_cache
def readiness_check(request):
    checks = {}
    for name, check in READINESS_CHECKS.items():
        try:
            check()
        except Exception:  # noqa: BLE001 - mọi lỗi phụ thuộc đều là "chưa sẵn sàng"
            logger.warning('Readiness: %s lỗi.', name, exc_info=True)
            checks[name] = 'error'
        else:
            checks[name] = 'ok'
    healthy = all(status == 'ok' for status in checks.values())
    return JsonResponse(
        {'status': 'ok' if healthy else 'error', 'checks': checks},
        status=200 if healthy else 503,
    )
