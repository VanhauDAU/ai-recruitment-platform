import json
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import SimpleTestCase

from config.asgi import application

from ..domain import CLOSE_UNAUTHORIZED, user_group
from ..services import SocketIdentity

IDENTITY = SocketIdentity(user_id=7, sid='sid-1', auth_revision=1)
SAME_ORIGIN = [(b'origin', b'http://testserver'), (b'host', b'testserver')]


def communicator(ticket='t', headers=SAME_ORIGIN):
    return WebsocketCommunicator(application, f'/ws/notifications/?ticket={ticket}', headers)


class NotificationConsumerTests(SimpleTestCase):
    @async_to_sync
    async def test_valid_ticket_joins_only_its_own_group_and_receives_pushes(self):
        with patch('apps.realtime.api.consumers.redeem_ticket', return_value=IDENTITY):
            socket = communicator()
            connected, _ = await socket.connect()
            self.assertTrue(connected)
            self.assertEqual(await socket.receive_json_from(), {'type': 'ready'})

            layer = get_channel_layer()
            await layer.group_send(user_group(8), {'type': 'push.event', 'event': {'type': 'x'}})
            event = {'type': 'notification.created', 'scope': 'employer'}
            await layer.group_send(user_group(7), {'type': 'push.event', 'event': event})

            self.assertEqual(await socket.receive_json_from(), event)
            self.assertTrue(await socket.receive_nothing())
            await socket.disconnect()

    @async_to_sync
    async def test_ping_is_answered_and_other_messages_are_ignored(self):
        with patch('apps.realtime.api.consumers.redeem_ticket', return_value=IDENTITY):
            socket = communicator()
            await socket.connect()
            await socket.receive_json_from()
            await socket.send_to(text_data=json.dumps({'type': 'subscribe', 'user': 8}))
            await socket.send_to(text_data='x' * 1000)
            await socket.send_to(text_data=json.dumps({'type': 'ping'}))

            self.assertEqual(await socket.receive_json_from(), {'type': 'pong'})
            await socket.disconnect()

    @async_to_sync
    async def test_bad_ticket_is_closed_with_the_reauth_code(self):
        with patch('apps.realtime.api.consumers.redeem_ticket', return_value=None):
            socket = communicator()
            connected, _ = await socket.connect()
            self.assertTrue(connected)
            self.assertEqual(
                await socket.receive_output(),
                {'type': 'websocket.close', 'code': CLOSE_UNAUTHORIZED},
            )

    @async_to_sync
    async def test_cross_site_handshake_is_refused_before_the_ticket_is_read(self):
        with patch('apps.realtime.api.consumers.redeem_ticket') as redeem:
            socket = communicator(
                headers=[(b'origin', b'https://evil.example'), (b'host', b'testserver')]
            )
            connected, _ = await socket.connect()

        self.assertFalse(connected)
        redeem.assert_not_called()

    @async_to_sync
    async def test_socket_closes_when_the_session_is_revoked(self):
        with (
            patch('apps.realtime.api.consumers.redeem_ticket', return_value=IDENTITY),
            patch('apps.realtime.api.consumers.REVALIDATE_SECONDS', 0.01),
            patch('apps.realtime.api.consumers.identity_is_authorized', return_value=False),
        ):
            socket = communicator()
            await socket.connect()
            await socket.receive_json_from()

            self.assertEqual(
                await socket.receive_output(),
                {'type': 'websocket.close', 'code': CLOSE_UNAUTHORIZED},
            )
