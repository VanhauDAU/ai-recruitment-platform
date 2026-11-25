"""The authenticated notification socket: ``/ws/notifications/?ticket=…``.

The socket is receive-only for the client: it never changes data and carries
no request other than a heartbeat, so it cannot widen what a user may do.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from common.metrics import record_metric

from ..domain import CLOSE_UNAUTHORIZED, MAX_CLIENT_MESSAGE_BYTES, REVALIDATE_SECONDS, user_group
from ..services import identity_is_authorized, redeem_ticket


class NotificationConsumer(AsyncWebsocketConsumer):
    identity = None
    group = ''
    _watchdog = None

    async def connect(self):
        ticket = parse_qs(self.scope.get('query_string', b'').decode()).get('ticket', [''])[0]
        self.identity = await database_sync_to_async(redeem_ticket)(ticket)
        if self.identity is None:
            record_metric('realtime_connection', status='rejected')
            # Accept-then-close: browsers expose the close code, not a refused handshake.
            await self.accept()
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        self.group = user_group(self.identity.user_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({'type': 'ready'}))
        self._watchdog = asyncio.ensure_future(self._revalidate_forever())
        record_metric('realtime_connection', status='opened')

    async def disconnect(self, code):
        if self._watchdog is not None:
            self._watchdog.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._watchdog
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data or len(text_data) > MAX_CLIENT_MESSAGE_BYTES:
            return
        with contextlib.suppress(ValueError):
            if json.loads(text_data).get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))

    async def push_event(self, message):
        await self.send(text_data=json.dumps(message['event'], ensure_ascii=False))

    async def _revalidate_forever(self):
        """Close the socket once a logout, ban, password change or idle timeout lands."""
        while True:
            await asyncio.sleep(REVALIDATE_SECONDS)
            if not await database_sync_to_async(identity_is_authorized)(self.identity):
                record_metric('realtime_connection', status='revoked')
                await self.close(code=CLOSE_UNAUTHORIZED)
                return
