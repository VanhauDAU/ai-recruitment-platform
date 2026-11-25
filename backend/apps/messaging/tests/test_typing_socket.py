import json
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import SimpleTestCase

from apps.realtime.domain import user_group
from apps.realtime.services import SocketIdentity
from config.asgi import application

IDENTITY = SocketIdentity(user_id=7, sid='sid-1', auth_revision=1)
HEADERS = [(b'origin', b'http://testserver'), (b'host', b'testserver')]


class TypingRelayTests(SimpleTestCase):
    @async_to_sync
    async def test_typing_is_relayed_to_the_other_member_and_throttled(self):
        with (
            patch('apps.realtime.api.consumers.redeem_ticket', return_value=IDENTITY),
            patch('apps.realtime.api.consumers.typing_target', return_value=(8, 'candidate')),
        ):
            sender = WebsocketCommunicator(application, '/ws/notifications/?ticket=t', HEADERS)
            await sender.connect()
            await sender.receive_json_from()
            layer = get_channel_layer()
            channel = await layer.new_channel()
            await layer.group_add(user_group(8), channel)

            for _ in range(3):
                await sender.send_to(
                    text_data=json.dumps({'type': 'typing', 'conversation': 'cnv_a'})
                )
            await sender.send_to(text_data=json.dumps({'type': 'ping'}))
            self.assertEqual(await sender.receive_json_from(), {'type': 'pong'})

            received = await layer.receive(channel)
            self.assertEqual(
                received['event'],
                {'type': 'chat.typing', 'conversation': 'cnv_a', 'role': 'candidate'},
            )
            with self.assertRaises(TimeoutError):
                import asyncio

                await asyncio.wait_for(layer.receive(channel), timeout=0.2)
            await sender.disconnect()

    @async_to_sync
    async def test_typing_for_a_foreign_conversation_is_dropped(self):
        with (
            patch('apps.realtime.api.consumers.redeem_ticket', return_value=IDENTITY),
            patch('apps.realtime.api.consumers.typing_target', return_value=None) as target,
        ):
            sender = WebsocketCommunicator(application, '/ws/notifications/?ticket=t', HEADERS)
            await sender.connect()
            await sender.receive_json_from()
            await sender.send_to(text_data=json.dumps({'type': 'typing', 'conversation': 'cnv_x'}))
            await sender.send_to(text_data=json.dumps({'type': 'ping'}))

            self.assertEqual(await sender.receive_json_from(), {'type': 'pong'})
            self.assertTrue(await sender.receive_nothing())
            target.assert_called_once_with(7, 'cnv_x')
            await sender.disconnect()
