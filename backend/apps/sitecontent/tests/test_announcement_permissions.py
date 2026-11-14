from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.tests.helpers import make_admin

from .announcement_helpers import revision_payload


class AnnouncementPermissionTests(APITestCase):
    def setUp(self):
        self.list_url = reverse('site-admin-announcements')

    def test_regular_admin_can_create_publish_and_revise(self):
        self.client.force_authenticate(make_admin('ann-admin@example.com'))
        created = self.client.post(
            self.list_url,
            {'internal_name': 'Thông báo admin thường', 'revision': revision_payload()},
            format='json',
        )
        public_id = created.data['public_id']
        published = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': 1, 'revision': 1},
            format='json',
        )
        revised = self.client.post(
            reverse('site-admin-announcement-revisions', kwargs={'public_id': public_id}),
            {
                'revision_token': published.data['revision_token'],
                'revision': revision_payload(message_vi='Bản sửa đổi'),
            },
            format='json',
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(published.status_code, status.HTTP_200_OK, published.data)
        self.assertEqual(revised.status_code, status.HTTP_201_CREATED, revised.data)

    def test_non_admin_is_rejected(self):
        candidate = User.objects.create_user(
            'ann-candidate@example.com', 'Password@123', role=User.Role.CANDIDATE
        )
        self.client.force_authenticate(candidate)

        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_403_FORBIDDEN)
