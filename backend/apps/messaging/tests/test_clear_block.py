"""Menu 3 chấm: xóa cuộc trò chuyện phía mình, chặn nhắn tin trong hội thoại."""

import uuid

from django.urls import reverse
from rest_framework.test import APITestCase

from ..services import typing_target
from .factories import ConnectFixture


class ClearAndBlockTests(ConnectFixture, APITestCase):
    def setUp(self):
        super().setUp()
        self.login(self.candidate)
        self.conversation_id = self.client.post(
            reverse('candidate-conversation-list'), {'job': self.job.public_id}, format='json'
        ).data['public_id']
        self.send(self.candidate, 'candidate', 'Chào anh chị')
        self.send(self.recruiter, 'employer', 'Chào bạn')

    def send(self, user, portal, body):
        self.login(user)
        return self.client.post(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id]),
            {'client_id': str(uuid.uuid4()), 'body': body},
            format='json',
        )

    def listed(self, user, portal):
        self.login(user)
        return self.client.get(reverse(f'{portal}-conversation-list')).data['count']

    def bodies(self, user, portal):
        self.login(user)
        rows = self.client.get(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id])
        ).data['results']
        return [row['body'] for row in rows if row['kind'] == 'text']

    def test_clearing_hides_history_only_for_me_until_a_new_message(self):
        self.login(self.candidate)
        cleared = self.client.post(
            reverse('candidate-conversation-clear', args=[self.conversation_id])
        )

        self.assertEqual(cleared.status_code, 204)
        self.assertEqual(self.listed(self.candidate, 'candidate'), 0)
        self.assertEqual(self.bodies(self.candidate, 'candidate'), [])
        self.assertEqual(self.listed(self.recruiter, 'employer'), 1)
        self.assertEqual(self.bodies(self.recruiter, 'employer'), ['Chào anh chị', 'Chào bạn'])

        self.send(self.recruiter, 'employer', 'Bạn còn quan tâm vị trí này không?')

        self.assertEqual(self.listed(self.candidate, 'candidate'), 1)
        self.assertEqual(
            self.bodies(self.candidate, 'candidate'), ['Bạn còn quan tâm vị trí này không?']
        )

    def test_blocking_stops_both_sides_until_the_blocker_unblocks(self):
        self.login(self.candidate)
        url = reverse('candidate-conversation-block', args=[self.conversation_id])

        blocked = self.client.post(url, {'blocked': True}, format='json')
        self.login(self.recruiter)
        recruiter_view = self.client.get(
            reverse('employer-conversation-detail', args=[self.conversation_id])
        ).data

        self.assertEqual(
            (blocked.data['locked_reason'], blocked.data['blocked_by_me']), ('blocked_by_me', True)
        )
        self.assertEqual(
            (recruiter_view['locked_reason'], recruiter_view['blocked_by_me']),
            ('unavailable', False),
        )
        self.assertEqual(self.send(self.recruiter, 'employer', 'hi').status_code, 403)
        self.assertEqual(self.send(self.candidate, 'candidate', 'hi').status_code, 403)
        self.assertIsNone(typing_target(self.recruiter.pk, self.conversation_id))
        self.assertEqual(self.events(self.recruiter)[-1]['type'], 'chat.conversation.updated')

        self.login(self.candidate)
        unblocked = self.client.post(url, {'blocked': False}, format='json')

        self.assertTrue(unblocked.data['can_send'])
        self.assertEqual(self.send(self.recruiter, 'employer', 'Chào lại').status_code, 201)

    def test_only_the_blocker_can_unblock(self):
        self.login(self.recruiter)
        self.client.post(
            reverse('employer-conversation-block', args=[self.conversation_id]),
            {'blocked': True},
            format='json',
        )
        self.login(self.candidate)

        attempt = self.client.post(
            reverse('candidate-conversation-block', args=[self.conversation_id]),
            {'blocked': False},
            format='json',
        )

        self.assertEqual(attempt.data['locked_reason'], 'unavailable')
        self.assertFalse(attempt.data['can_send'])
