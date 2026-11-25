import uuid
from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.applications.models import Application, CandidateBlock, CandidateSearchInvitation
from apps.applications.services import withdraw_application
from apps.employers.services import profiles as employer_profiles

from ..domain import Role
from ..models import Conversation, Message
from .factories import ConnectFixture


class StartConversationTests(ConnectFixture, APITestCase):
    def start_as_candidate(self, job=None):
        self.login(self.candidate)
        return self.client.post(
            reverse('candidate-conversation-list'),
            {'job': (job or self.job).public_id},
            format='json',
        )

    def test_candidate_opens_one_conversation_per_job_after_applying(self):
        first = self.start_as_candidate()
        again = self.start_as_candidate()

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.data['public_id'], again.data['public_id'])
        self.assertEqual(first.data['counterpart']['name'], 'Connect Co')
        self.assertEqual(first.data['application']['status'], 'submitted')
        self.assertTrue(first.data['can_send'])
        self.assertEqual(first.data['candidate_limit_remaining'], 3)
        conversation = Conversation.objects.get()
        system = conversation.messages.get()
        self.assertEqual((system.kind, system.payload['event']), ('system', 'started'))
        # Chưa gửi gì: chưa là hoạt động, không báo, không tính chưa đọc cho bên nào.
        self.assertIsNone(conversation.last_message_at)
        self.assertEqual((conversation.candidate_unread, conversation.recruiter_unread), (0, 0))
        self.assertFalse(
            [event for event in self.events(self.recruiter) if event['type'].startswith('chat.')]
        )

    def test_empty_conversation_stays_out_of_both_lists_until_the_first_message(self):
        public_id = self.start_as_candidate().data['public_id']
        self.login(self.recruiter)
        hidden = self.client.get(reverse('employer-conversation-list')).data['count']
        unread = self.client.get(reverse('employer-conversation-unread-count')).data['count']
        self.login(self.candidate)
        own_list = self.client.get(reverse('candidate-conversation-list')).data['count']
        detail = self.client.get(reverse('candidate-conversation-detail', args=[public_id]))

        self.client.post(
            reverse('candidate-conversation-messages', args=[public_id]),
            {'client_id': str(uuid.uuid4()), 'body': 'Chào anh chị'},
            format='json',
        )
        self.login(self.recruiter)
        shown = self.client.get(reverse('employer-conversation-list')).data['count']

        self.assertEqual((hidden, unread, own_list), (0, 0, 0))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(shown, 1)
        self.assertEqual(self.events(self.recruiter)[-1]['type'], 'chat.message.created')

    def test_candidate_cannot_open_without_a_current_application(self):
        other_job = self.make_job('Other job')

        response = self.start_as_candidate(other_job)

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Conversation.objects.exists())

    def test_withdrawn_application_cannot_open(self):
        withdraw_application(candidate=self.candidate, public_id=self.application.public_id)

        self.assertEqual(self.start_as_candidate().status_code, 403)

    def test_blocked_candidate_gets_a_neutral_refusal(self):
        CandidateBlock.objects.create(
            recruiter=self.recruiter, company=self.company, candidate=self.candidate, reason='spam'
        )

        response = self.start_as_candidate()

        self.assertEqual(response.status_code, 403)
        self.assertNotIn('chặn', str(response.data))

    def test_recruiter_opens_from_own_application_only(self):
        self.login(self.outsider)
        refused = self.client.post(
            reverse('employer-conversation-list'),
            {'application': self.application.public_id},
            format='json',
        )
        self.login(self.recruiter)
        opened = self.client.post(
            reverse('employer-conversation-list'),
            {'application': self.application.public_id},
            format='json',
        )

        self.assertEqual(refused.status_code, 404)
        self.assertEqual(opened.status_code, 201, opened.data)
        self.assertEqual(opened.data['counterpart']['name'], 'Nguyễn Văn A')
        self.assertIsNone(opened.data['candidate_limit_remaining'])

    def test_recruiter_opens_from_an_accepted_connection_invitation(self):
        job = self.make_job('Invite job')
        invitation = CandidateSearchInvitation.objects.create(
            recruiter=self.recruiter,
            candidate=self.candidate,
            job=job,
            status=CandidateSearchInvitation.Status.ACCEPTED,
        )
        self.login(self.recruiter)

        response = self.client.post(
            reverse('employer-conversation-list'),
            {'invitation': invitation.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Conversation.objects.get().origin, Conversation.Origin.INVITATION)
        self.assertIsNone(response.data['application'])

    def test_pending_invitation_and_ambiguous_payload_are_refused(self):
        invitation = CandidateSearchInvitation.objects.create(
            recruiter=self.recruiter, candidate=self.candidate, job=self.make_job('Pending')
        )
        self.login(self.recruiter)
        url = reverse('employer-conversation-list')

        pending = self.client.post(url, {'invitation': invitation.public_id}, format='json')
        both = self.client.post(
            url,
            {'invitation': invitation.public_id, 'application': self.application.public_id},
            format='json',
        )

        self.assertEqual(pending.status_code, 404)
        self.assertEqual(both.status_code, 400)

    def test_disabled_switch_refuses_new_conversations(self):
        with patch('apps.messaging.services.conversations.connect_enabled', return_value=False):
            self.assertEqual(self.start_as_candidate().status_code, 403)


class MessagingTests(ConnectFixture, APITestCase):
    def setUp(self):
        super().setUp()
        self.login(self.candidate)
        response = self.client.post(
            reverse('candidate-conversation-list'), {'job': self.job.public_id}, format='json'
        )
        self.conversation_id = response.data['public_id']

    def send(self, user, portal, **payload):
        self.login(user)
        payload.setdefault('client_id', str(uuid.uuid4()))
        return self.client.post(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id]),
            payload,
            format='json',
        )

    def messages(self, user, portal, **params):
        self.login(user)
        return self.client.get(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id]), params
        )

    def test_text_message_gets_the_next_seq_and_is_pushed_to_both_sides(self):
        response = self.send(self.candidate, 'candidate', body='  Chào anh chị 👋  ')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['seq'], 2)
        self.assertEqual(response.data['body'], 'Chào anh chị 👋')
        self.assertTrue(response.data['mine'])
        pushed = self.events(self.recruiter)[-1]
        self.assertEqual(pushed['type'], 'chat.message.created')
        self.assertFalse(pushed['message']['mine'])
        self.assertEqual(pushed['unread_count'], 1)
        self.assertIsInstance(pushed['message']['created_at'], str)
        self.assertEqual(self.events(self.candidate)[-1]['message']['seq'], 2)

    def test_same_client_id_returns_the_stored_message(self):
        client_id = str(uuid.uuid4())

        first = self.send(self.candidate, 'candidate', body='Một', client_id=client_id)
        again = self.send(self.candidate, 'candidate', body='Một', client_id=client_id)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.data['public_id'], again.data['public_id'])
        self.assertEqual(Message.objects.filter(kind='text').count(), 1)

    def test_empty_or_too_long_text_is_refused(self):
        self.assertEqual(self.send(self.candidate, 'candidate', body='   ').status_code, 400)
        self.assertEqual(self.send(self.candidate, 'candidate', body='x' * 2001).status_code, 400)

    def test_candidate_waits_for_a_reply_after_three_messages(self):
        for index in range(3):
            self.assertEqual(
                self.send(self.candidate, 'candidate', body=f'm{index}').status_code, 201
            )

        blocked = self.send(self.candidate, 'candidate', body='m3')
        reply = self.send(self.recruiter, 'employer', body='Chào bạn')
        after_reply = self.send(self.candidate, 'candidate', body='Cảm ơn')

        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(after_reply.status_code, 201)

    def test_pages_go_back_by_seq_and_fill_gaps_after(self):
        for index in range(5):
            self.send(self.recruiter, 'employer', body=f'r{index}')

        latest = self.messages(self.candidate, 'candidate', limit=2)
        older = self.messages(
            self.candidate, 'candidate', limit=2, before=latest.data['results'][0]['seq']
        )
        gap = self.messages(self.candidate, 'candidate', after=3)

        self.assertEqual([row['seq'] for row in latest.data['results']], [5, 6])
        self.assertTrue(latest.data['has_more'])
        self.assertEqual([row['seq'] for row in older.data['results']], [3, 4])
        self.assertEqual([row['seq'] for row in gap.data['results']], [4, 5, 6])
        self.assertFalse(gap.data['has_more'])

    def test_read_marks_clear_unread_and_tell_the_other_side(self):
        self.send(self.recruiter, 'employer', body='r1')
        self.send(self.recruiter, 'employer', body='r2')
        self.login(self.candidate)
        unread = self.client.get(reverse('candidate-conversation-unread-count')).data['count']

        response = self.client.post(
            reverse('candidate-conversation-read', args=[self.conversation_id]),
            {'seq': 99},
            format='json',
        )

        conversation = Conversation.objects.get()
        self.assertEqual(unread, 1)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(conversation.candidate_last_read_seq, conversation.last_seq)
        self.assertEqual(conversation.candidate_unread, 0)
        read = self.events(self.recruiter)[-1]
        self.assertEqual((read['type'], read['role']), ('chat.read', 'candidate'))
        detail = self.client.get(
            reverse('candidate-conversation-detail', args=[self.conversation_id])
        )
        self.assertEqual(detail.data['unread_count'], 0)

    def test_outsiders_cannot_read_or_write(self):
        self.login(self.outsider)
        self.assertEqual(
            self.client.get(
                reverse('employer-conversation-detail', args=[self.conversation_id])
            ).status_code,
            404,
        )
        self.assertEqual(self.send(self.outsider, 'employer', body='hi').status_code, 404)

    def test_block_locks_the_conversation_with_a_neutral_reason_for_the_candidate(self):
        self.send(self.candidate, 'candidate', body='Chào anh chị')
        CandidateBlock.objects.create(
            recruiter=self.recruiter, company=self.company, candidate=self.candidate, reason='spam'
        )
        self.login(self.candidate)
        candidate_view = self.client.get(reverse('candidate-conversation-list')).data['results'][0]
        self.login(self.recruiter)
        recruiter_view = self.client.get(reverse('employer-conversation-list')).data['results'][0]

        self.assertEqual(candidate_view['locked_reason'], 'unavailable')
        self.assertEqual(recruiter_view['locked_reason'], 'blocked')
        self.assertEqual(self.send(self.candidate, 'candidate', body='hi').status_code, 403)

    def test_withdrawal_makes_the_conversation_read_only(self):
        withdraw_application(candidate=self.candidate, public_id=self.application.public_id)

        response = self.send(self.recruiter, 'employer', body='hi')

        self.assertEqual(response.status_code, 403)

    def test_candidate_sees_published_status_only(self):
        Application.objects.filter(pk=self.application.pk).update(status='rejected')
        self.login(self.candidate)

        detail = self.client.get(
            reverse('candidate-conversation-detail', args=[self.conversation_id])
        )

        self.assertEqual(detail.data['application']['status'], 'submitted')

    def test_search_filters_by_job_or_counterpart(self):
        self.send(self.candidate, 'candidate', body='Chào anh chị')
        self.login(self.recruiter)
        url = reverse('employer-conversation-list')

        self.assertEqual(self.client.get(url, {'q': 'Nguyễn'}).data['count'], 1)
        self.assertEqual(self.client.get(url, {'q': 'Backend'}).data['count'], 1)
        self.assertEqual(self.client.get(url, {'q': 'không có'}).data['count'], 0)

    def test_list_query_count_does_not_grow_with_conversations(self):
        for index in range(4):
            job = self.make_job(f'Job {index}')
            self.apply(self.candidate, job)
            self.login(self.candidate)
            opened = self.client.post(
                reverse('candidate-conversation-list'), {'job': job.public_id}, format='json'
            )
            self.client.post(
                reverse('candidate-conversation-messages', args=[opened.data['public_id']]),
                {'client_id': str(uuid.uuid4()), 'body': f'Chào {index}'},
                format='json',
            )
        self.send(self.candidate, 'candidate', body='Chào anh chị')
        self.login(self.recruiter)
        url = reverse('employer-conversation-list')
        self.client.get(url)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url)

        self.assertEqual(response.data['count'], 5)
        self.assertLessEqual(len(queries), 16, [query['sql'] for query in queries])

    def test_recruiter_shares_a_job_card_and_candidate_cannot(self):
        other = self.make_job('Frontend Developer')

        shared = self.send(self.recruiter, 'employer', kind='job', job=other.public_id)
        refused = self.send(self.candidate, 'candidate', kind='job', job=other.public_id)

        self.assertEqual(shared.status_code, 201, shared.data)
        self.assertEqual(shared.data['job']['title'], 'Frontend Developer')
        self.assertEqual(shared.data['job']['company_name'], 'Connect Co')
        self.assertEqual(refused.status_code, 403)

    def test_candidate_shares_a_cv_snapshot(self):
        response = self.send(self.candidate, 'candidate', kind='cv', cv=self.cv.public_id)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['cv']['title'], 'CV Connect')
        self.assertFalse(response.data['cv']['has_file'])
        message = Message.objects.get(kind='cv')
        self.assertEqual(message.cv_version.version_kind, 'application_snapshot')
        self.login(self.recruiter)
        file_response = self.client.get(
            reverse(
                'employer-conversation-message-file', args=[self.conversation_id, message.public_id]
            )
        )
        self.assertEqual(file_response.status_code, 404)

    def test_side_lists_for_each_portal(self):
        self.login(self.candidate)
        applied = self.client.get(reverse('candidate-conversation-applied-jobs')).data
        cvs = self.client.get(reverse('candidate-conversation-shareable-cvs')).data
        self.login(self.recruiter)
        jobs = self.client.get(reverse('employer-conversation-shareable-jobs')).data

        self.assertEqual(applied[0]['conversation_public_id'], self.conversation_id)
        self.assertTrue(applied[0]['can_start'])
        self.assertEqual(cvs[0]['public_id'], self.cv.public_id)
        self.assertEqual([job['public_id'] for job in jobs], [self.job.public_id])

    def test_role_values_match_the_contract(self):
        self.assertEqual([str(role) for role in Role], ['candidate', 'recruiter', 'system'])


class RecruiterDataAccessTests(ConnectFixture, APITestCase):
    """NTD mất xác thực/DPA sau khi đã mở hội thoại thì không đọc, gửi hay nhận tin nữa."""

    def setUp(self):
        super().setUp()
        self.login(self.candidate)
        self.conversation_id = self.client.post(
            reverse('candidate-conversation-list'), {'job': self.job.public_id}, format='json'
        ).data['public_id']
        real = employer_profiles.recruiter_readiness_state

        def blocked(user, **kwargs):
            recruiter, readiness = real(user, **kwargs)
            return recruiter, {**readiness, 'candidate_data_access': False}

        for target in (
            'apps.employers.services.profiles.recruiter_readiness_state',
            'apps.messaging.services.realtime.recruiter_readiness_state',
        ):
            patcher = patch(target, side_effect=blocked)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_every_recruiter_endpoint_is_refused(self):
        self.login(self.recruiter)
        urls = [
            reverse('employer-conversation-list'),
            reverse('employer-conversation-unread-count'),
            reverse('employer-conversation-detail', args=[self.conversation_id]),
            reverse('employer-conversation-messages', args=[self.conversation_id]),
        ]

        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)
        sent = self.client.post(
            reverse('employer-conversation-messages', args=[self.conversation_id]),
            {'client_id': str(uuid.uuid4()), 'body': 'hi'},
            format='json',
        )
        self.assertEqual(sent.status_code, 403)
        self.assertFalse(Message.objects.filter(kind='text').exists())

    def test_candidate_messages_are_not_pushed_to_the_recruiter(self):
        self.layer.sent.clear()
        self.login(self.candidate)

        response = self.client.post(
            reverse('candidate-conversation-messages', args=[self.conversation_id]),
            {'client_id': str(uuid.uuid4()), 'body': 'Chào anh chị'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(
            [event for event in self.events(self.recruiter) if event['type'].startswith('chat.')]
        )
        self.assertEqual(self.events(self.candidate)[-1]['type'], 'chat.message.created')
