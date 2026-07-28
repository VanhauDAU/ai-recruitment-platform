from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import AdminAccessAuditLog, User

from ..models import Announcement, AnnouncementRevision
from .announcement_helpers import revision_payload


class AdminAnnouncementApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-superuser@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.client.force_authenticate(self.admin)
        self.list_url = reverse('site-admin-announcements')

    def create(self, *, internal_name='Thông báo thử nghiệm', **overrides):
        return self.client.post(
            self.list_url,
            {
                'internal_name': internal_name,
                'revision': revision_payload(**overrides),
            },
            format='json',
        )

    def test_create_revision_publish_and_lifecycle_workflow(self):
        created = self.create()
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        public_id = created.data['public_id']
        self.assertEqual(created.data['revision_token'], 1)
        self.assertEqual(created.data['revisions'][0]['number'], 1)
        self.assertFalse(created.data['revisions'][0]['is_active'])

        revision = self.client.post(
            reverse('site-admin-announcement-revisions', kwargs={'public_id': public_id}),
            {
                'revision_token': 1,
                'revision': revision_payload(message_vi='Nội dung revision 2'),
            },
            format='json',
        )
        self.assertEqual(revision.status_code, status.HTTP_201_CREATED, revision.data)
        self.assertEqual(revision.data['revision_token'], 2)
        self.assertEqual([item['number'] for item in revision.data['revisions']], [2, 1])

        published = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': 2, 'revision': 2},
            format='json',
        )
        self.assertEqual(published.status_code, status.HTTP_200_OK, published.data)
        self.assertEqual(published.data['lifecycle_state'], Announcement.LifecycleState.PUBLISHED)
        self.assertEqual(published.data['active_revision_number'], 2)
        self.assertEqual(published.data['revisions'][0]['message_vi'], 'Nội dung revision 2')
        self.assertTrue(published.data['revisions'][0]['is_active'])

        paused = self.client.post(
            reverse('site-admin-announcement-pause', kwargs={'public_id': public_id}),
            {'revision_token': 3},
            format='json',
        )
        resumed = self.client.post(
            reverse('site-admin-announcement-resume', kwargs={'public_id': public_id}),
            {'revision_token': 4},
            format='json',
        )
        archived = self.client.post(
            reverse('site-admin-announcement-archive', kwargs={'public_id': public_id}),
            {'revision_token': 5},
            format='json',
        )

        self.assertEqual(paused.data['lifecycle_state'], Announcement.LifecycleState.PAUSED)
        self.assertEqual(resumed.data['lifecycle_state'], Announcement.LifecycleState.PUBLISHED)
        self.assertEqual(archived.data['lifecycle_state'], Announcement.LifecycleState.ARCHIVED)
        self.assertEqual(
            list(
                AdminAccessAuditLog.objects.filter(target_public_id=public_id).values_list(
                    'action',
                    flat=True,
                )
            ),
            [
                'announcement_archive',
                'announcement_resume',
                'announcement_pause',
                'announcement_publish',
                'announcement_create_revision',
                'announcement_create',
            ],
        )

    def test_stale_token_returns_409_without_overwriting_newer_state(self):
        created = self.create()
        public_id = created.data['public_id']
        detail_url = reverse(
            'site-admin-announcement-detail',
            kwargs={'public_id': public_id},
        )
        first = self.client.patch(
            detail_url,
            {'internal_name': 'Tên mới', 'revision_token': 1},
            format='json',
        )
        stale = self.client.patch(
            detail_url,
            {'internal_name': 'Ghi đè từ tab cũ', 'revision_token': 1},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(stale.data['code'], 'announcement_revision_stale')
        self.assertEqual(stale.data['current_revision_token'], 2)
        self.assertEqual(
            Announcement.objects.get(public_id=public_id).internal_name,
            'Tên mới',
        )

    def test_published_revision_remains_immutable_when_new_draft_is_created(self):
        created = self.create(message_vi='Bản phát hành')
        public_id = created.data['public_id']
        published = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': 1, 'revision': 1},
            format='json',
        )
        new_revision = self.client.post(
            reverse('site-admin-announcement-revisions', kwargs={'public_id': public_id}),
            {
                'revision_token': published.data['revision_token'],
                'revision': revision_payload(message_vi='Bản nháp mới'),
            },
            format='json',
        )

        announcement = Announcement.objects.get(public_id=public_id)
        self.assertEqual(new_revision.status_code, status.HTTP_201_CREATED)
        self.assertEqual(announcement.active_revision.number, 1)
        self.assertEqual(announcement.active_revision.message_vi, 'Bản phát hành')
        self.assertEqual(
            AnnouncementRevision.objects.get(announcement=announcement, number=2).message_vi,
            'Bản nháp mới',
        )

    def test_duplicate_is_draft_and_does_not_expose_source_internal_state(self):
        created = self.create(internal_name='Thông báo nguồn')
        duplicated = self.client.post(
            reverse(
                'site-admin-announcement-duplicate',
                kwargs={'public_id': created.data['public_id']},
            ),
            {'revision_token': 1, 'internal_name': 'Thông báo bản sao'},
            format='json',
        )

        self.assertEqual(duplicated.status_code, status.HTTP_201_CREATED, duplicated.data)
        self.assertNotEqual(duplicated.data['public_id'], created.data['public_id'])
        self.assertEqual(duplicated.data['internal_name'], 'Thông báo bản sao')
        self.assertEqual(duplicated.data['lifecycle_state'], Announcement.LifecycleState.DRAFT)
        self.assertEqual(
            duplicated.data['revisions'][0]['message_vi'],
            created.data['revisions'][0]['message_vi'],
        )

    def test_validation_rejects_unsafe_url_schedule_and_critical_dismiss(self):
        unsafe = self.create(cta_url='javascript:alert(1)')
        bad_schedule = self.create(
            starts_at='2026-08-02T00:00:00Z',
            ends_at='2026-08-01T00:00:00Z',
        )
        critical = self.create(
            kind=AnnouncementRevision.Kind.CRITICAL,
            ends_at=None,
            dismiss_mode=AnnouncementRevision.DismissMode.CLOSE,
        )

        self.assertEqual(unsafe.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cta_url', unsafe.data['revision'])
        self.assertEqual(bad_schedule.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ends_at', bad_schedule.data['revision'])
        self.assertEqual(critical.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('dismiss_mode', critical.data['revision'])

    def test_list_uses_sorting_whitelist_and_stable_fallback(self):
        self.create(internal_name='Alpha', priority=10)
        self.create(internal_name='Beta', priority=90)

        by_name = self.client.get(self.list_url, {'ordering': 'internal_name'})
        invalid = self.client.get(self.list_url, {'ordering': 'secret_field'})

        self.assertEqual(
            [item['internal_name'] for item in by_name.data['results']],
            ['Alpha', 'Beta'],
        )
        self.assertEqual(invalid.status_code, status.HTTP_200_OK)
        self.assertEqual(len(invalid.data['results']), 2)

    def test_archived_announcement_is_terminal_but_can_be_duplicated(self):
        created = self.create()
        public_id = created.data['public_id']
        archived = self.client.post(
            reverse('site-admin-announcement-archive', kwargs={'public_id': public_id}),
            {'revision_token': 1},
            format='json',
        )
        publish = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': archived.data['revision_token'], 'revision': 1},
            format='json',
        )
        revision = self.client.post(
            reverse('site-admin-announcement-revisions', kwargs={'public_id': public_id}),
            {
                'revision_token': archived.data['revision_token'],
                'revision': revision_payload(message_vi='Không được tạo'),
            },
            format='json',
        )
        duplicate = self.client.post(
            reverse('site-admin-announcement-duplicate', kwargs={'public_id': public_id}),
            {
                'revision_token': archived.data['revision_token'],
                'internal_name': 'Bản sao từ archive',
            },
            format='json',
        )

        self.assertEqual(archived.status_code, status.HTTP_200_OK)
        self.assertEqual(publish.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(revision.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(duplicate.status_code, status.HTTP_201_CREATED)
