"""Cấu hình channel layer Redis thật (bộ test dùng InMemoryChannelLayer nên không chạm tới).

Thời gian chờ đọc của kết nối Redis phải dài hơn khoảng BZPOPMIN mà
channels_redis chặn khi chờ tin; bằng hoặc ngắn hơn thì mỗi socket rảnh sẽ lỗi
TimeoutError và bị ngắt (redis-py 8 mặc định 5 giây, đúng bằng khoảng chặn).
"""

from channels_redis.core import RedisChannelLayer
from channels_redis.utils import create_pool

from config.settings.components import tasks


def test_redis_read_timeout_outlasts_the_blocking_receive():
    host = tasks.CHANNEL_LAYERS['default']['CONFIG']['hosts'][0]
    pool = create_pool(host)

    assert pool.connection_kwargs['socket_timeout'] == tasks.CHANNEL_LAYER_SOCKET_TIMEOUT
    assert pool.connection_kwargs['socket_timeout'] > RedisChannelLayer.brpop_timeout
