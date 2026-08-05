from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .announcement_helpers import create_admin_with_permissions, revision_payload


class AnnouncementPermissionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.list_url = reverse('site-admin-announcements')

    def test_view_only_admin_can_read_but_cannot_create(self):
        viewer = create_admin_with_permissions('announcement.view', email='ann-view@example.com')
        self.client.force_authenticate(viewer)

        get_response = self.client.get(self.list_url)
        post_response = self.client.post(
            self.list_url,
            {'internal_name': 'Không được tạo', 'revision': revision_payload()},
            format='json',
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(post_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_cannot_publish_and_publisher_cannot_create_revision(self):
        manager = create_admin_with_permissions(
            'announcement.view',
            'announcement.manage',
            email='ann-manager@example.com',
        )
        self.client.force_authenticate(manager)
        created = self.client.post(
            self.list_url,
            {'internal_name': 'Phân quyền', 'revision': revision_payload()},
            format='json',
        )
        public_id = created.data['public_id']
        denied_publish = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': 1, 'revision': 1},
            format='json',
        )

        publisher = create_admin_with_permissions(
            'announcement.view',
            'announcement.publish',
            email='ann-publisher@example.com',
        )
        self.client.force_authenticate(publisher)
        allowed_publish = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': 1, 'revision': 1},
            format='json',
        )
        denied_revision = self.client.post(
            reverse('site-admin-announcement-revisions', kwargs={'public_id': public_id}),
            {
                'revision_token': allowed_publish.data['revision_token'],
                'revision': revision_payload(message_vi='Không được tạo'),
            },
            format='json',
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(denied_publish.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(allowed_publish.status_code, status.HTTP_200_OK)
        self.assertEqual(denied_revision.status_code, status.HTTP_403_FORBIDDEN)

    def test_manage_or_publish_without_view_fails_closed(self):
        manager_without_view = create_admin_with_permissions(
            'announcement.manage',
            email='ann-invalid-manager@example.com',
        )
        self.client.force_authenticate(manager_without_view)
        response = self.client.post(
            self.list_url,
            {'internal_name': 'Thiếu quyền xem', 'revision': revision_payload()},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
