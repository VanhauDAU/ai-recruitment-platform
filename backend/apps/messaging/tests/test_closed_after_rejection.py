"""Hồ sơ "Không phù hợp" đã báo ứng viên thì hội thoại đóng gửi tin; nộp lại thì mở."""

import uuid
from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.applications.models import Application, ApplicationStatusHistory
from apps.applications.services import change_application_status

from .factories import ConnectFixture


class ClosedAfterRejectionTests(ConnectFixture, APITestCase):
    def setUp(self):
        super().setUp()
        self.login(self.candidate)
        self.conversation_id = self.client.post(
            reverse('candidate-conversation-list'), {'job': self.job.public_id}, format='json'
        ).data['public_id']
        self.send(self.candidate, 'candidate', 'Chào anh chị')

    def send(self, user, portal, body):
        self.login(user)
        return self.client.post(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id]),
            {'client_id': str(uuid.uuid4()), 'body': body},
            format='json',
        )

    def detail(self, user, portal):
        self.login(user)
        return self.client.get(
            reverse(f'{portal}-conversation-detail', args=[self.conversation_id])
        ).data

    def publish_rejection(self):
        Application.objects.filter(pk=self.application.pk).update(status='rejected')
        ApplicationStatusHistory.objects.create(
            application=self.application, from_status='submitted', to_status='rejected'
        )

    def test_published_rejection_closes_sending_for_both_sides(self):
        self.publish_rejection()

        self.assertEqual(self.detail(self.candidate, 'candidate')['locked_reason'], 'closed')
        self.assertEqual(self.detail(self.recruiter, 'employer')['locked_reason'], 'closed')
        self.assertEqual(self.send(self.candidate, 'candidate', 'Xin phản hồi').status_code, 403)
        self.assertEqual(self.send(self.recruiter, 'employer', 'Cảm ơn bạn').status_code, 403)
        # Vẫn xem được lịch sử.
        self.login(self.candidate)
        history = self.client.get(
            reverse('candidate-conversation-messages', args=[self.conversation_id])
        )
        self.assertEqual(history.status_code, 200)

    def test_rejection_inside_the_undo_window_does_not_close_yet(self):
        change_application_status(self.application, changed_by=self.recruiter, status='rejected')

        self.assertTrue(self.detail(self.candidate, 'candidate')['can_send'])
        self.assertEqual(
            self.send(self.recruiter, 'employer', 'Còn trao đổi được').status_code, 201
        )

    def test_reapplying_reopens_the_conversation(self):
        self.publish_rejection()
        with patch(
            'apps.applications.services.applications.reapply_cooldown', return_value=timedelta(0)
        ):
            self.apply(self.candidate, self.job)

        self.assertTrue(self.detail(self.candidate, 'candidate')['can_send'])

    def test_a_rejected_application_cannot_open_a_new_conversation(self):
        other = self.make_job('Tin khác')
        application = self.apply(self.candidate, other)
        Application.objects.filter(pk=application.pk).update(status='rejected')
        ApplicationStatusHistory.objects.create(
            application=application, from_status='submitted', to_status='rejected'
        )
        self.login(self.candidate)

        refused = self.client.post(
            reverse('candidate-conversation-list'), {'job': other.public_id}, format='json'
        )
        applied = self.client.get(reverse('candidate-conversation-applied-jobs')).data

        self.assertEqual(refused.status_code, 403)
        row = next(item for item in applied if item['job']['public_id'] == other.public_id)
        self.assertFalse(row['can_start'])
