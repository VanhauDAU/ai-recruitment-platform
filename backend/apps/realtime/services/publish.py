"""Push small events to open sockets after the transaction commits.

Events are hints, never the source of truth: the client refetches through the
REST API, which applies every permission rule again. Delivery is best effort;
a lost event is caught by the refetch the client makes on (re)connect.
"""

from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from common.metrics import record_metric

from ..domain import ADMIN_GROUP, ADMIN_QUEUE_CHANGED, user_group

logger = logging.getLogger(__name__)


def _send(group, event):
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(group, {'type': 'push.event', 'event': event})
    except Exception:  # noqa: BLE001 - realtime must never break the domain write
        logger.warning('Realtime push to %s failed.', group, exc_info=True)
        record_metric('realtime_push', status='error', event=event.get('type', ''))
        return
    record_metric('realtime_push', status='sent', event=event.get('type', ''))


def push_to_user(user_id, event):
    """Queue ``event`` for ``user_id``; sent only if the surrounding transaction commits."""
    group = user_group(user_id)
    transaction.on_commit(lambda: _send(group, event))


def notify_admin_queue(queue):
    """Tell every open admin socket that the ``queue`` counts may have changed.

    ``queue`` is a key of the admin queue summary (``/api/admin/dashboard/queues/``);
    admins refetch that summary and the matching list over REST.
    """
    event = {'type': ADMIN_QUEUE_CHANGED, 'queue': queue}
    transaction.on_commit(lambda: _send(ADMIN_GROUP, event))
