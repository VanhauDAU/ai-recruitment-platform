"""The authenticated notification socket: ``/ws/notifications/?ticket=…``.

The client never changes data through it: besides the heartbeat it may only
announce "typing" in a ProCV Connect conversation it belongs to (ADR-0032),
which is relayed to the other side and never stored.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.messaging.domain import TYPING_MIN_INTERVAL_SECONDS
from apps.messaging.services import typing_target
from common.metrics import record_metric

from ..domain import CLOSE_UNAUTHORIZED, MAX_CLIENT_MESSAGE_BYTES, REVALIDATE_SECONDS, user_group
from ..services import identity_is_authorized, redeem_ticket


class NotificationConsumer(AsyncWebsocketConsumer):
    identity = None
    group = ''
    _watchdog = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._typing_sent = {}
        self._typing_targets = {}

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
        try:
            message = json.loads(text_data)
        except ValueError:
            return
        if not isinstance(message, dict):
            return
        if message.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
        elif message.get('type') == 'typing':
            await self._relay_typing(str(message.get('conversation') or '')[:50])

    async def _relay_typing(self, conversation):
        """Chuyển "đang soạn tin" cho phía kia; dồn dập hoặc không phải thành viên thì bỏ."""
        now = time.monotonic()
        last = self._typing_sent.get(conversation, 0)
        if not conversation or now - last < TYPING_MIN_INTERVAL_SECONDS:
            return
        self._typing_sent[conversation] = now
        cached = self._typing_targets.get(conversation)
        if cached is None or cached[1] < now:
            target = await database_sync_to_async(typing_target)(
                self.identity.user_id, conversation
            )
            cached = (target, now + REVALIDATE_SECONDS)
            self._typing_targets[conversation] = cached
        target = cached[0]
        if target is None or target[0] is None:
            return
        recipient, role = target
        await self.channel_layer.group_send(
            user_group(recipient),
            {
                'type': 'push.event',
                'event': {'type': 'chat.typing', 'conversation': conversation, 'role': str(role)},
            },
        )

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
