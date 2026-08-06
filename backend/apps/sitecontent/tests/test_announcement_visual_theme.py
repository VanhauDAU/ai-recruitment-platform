from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import Announcement, AnnouncementRevision
from ..services import normalize_revision_data
from .announcement_helpers import revision_payload


def _png_bytes(width, height, color=(16, 185, 129)):
    buffer = BytesIO()
    Image.new('RGB', (width, height), color).save(buffer, format='PNG')
    return buffer.getvalue()


class AnnouncementVisualThemeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-visual@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.client.force_authenticate(self.admin)
        self.list_url = reverse('site-admin-announcements')

    def test_normalize_defaults_to_kind_theme(self):
        data = normalize_revision_data(revision_payload())
        self.assertEqual(data['theme_mode'], AnnouncementRevision.ThemeMode.KIND)
        self.assertEqual(data['theme_preset'], '')
        self.assertEqual(data['color_accent'], '')
        self.assertEqual(data['background_image'], '')
        self.assertEqual(data['background_overlay'], AnnouncementRevision.BackgroundOverlay.NONE)

    def test_normalize_custom_hex_and_background_forces_overlay(self):
        data = normalize_revision_data(
            revision_payload(
                theme_mode='custom',
                color_accent='#0f766e',
                color_bg_from='#ecfdf5',
                color_bg_to='#f0fdfa',
                color_fg='#134e4a',
                background_image='site/announcements/backgrounds/demo.webp',
                background_overlay='none',
            )
        )
        self.assertEqual(data['theme_mode'], 'custom')
        self.assertEqual(data['color_accent'], '#0F766E')
        self.assertEqual(data['background_image'], 'site/announcements/backgrounds/demo.webp')
        self.assertEqual(data['background_overlay'], 'dark')

    def test_normalize_rejects_invalid_hex_and_url_background(self):
        with self.assertRaises(Exception):
            normalize_revision_data(
                revision_payload(theme_mode='custom', color_accent='green')
            )
        with self.assertRaises(Exception):
            normalize_revision_data(
                revision_payload(
                    background_image='https://cdn.example.com/banner.png',
                )
            )

    def test_admin_create_and_public_feed_expose_theme_and_background(self):
        created = self.client.post(
            self.list_url,
            {
                'internal_name': 'Campaign banner',
                'revision': revision_payload(
                    theme_mode='preset',
                    theme_preset='ocean',
                    background_image='site/announcements/backgrounds/980x31.webp',
                    background_fit='cover',
                    background_position='center',
                    background_overlay='dark',
                ),
            },
            format='json',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        rev = created.data['revisions'][0]
        self.assertEqual(rev['theme_mode'], 'preset')
        self.assertEqual(rev['theme_preset'], 'ocean')
        self.assertEqual(rev['theme']['mode'], 'preset')
        self.assertEqual(rev['theme']['preset'], 'ocean')
        self.assertEqual(
            rev['background']['image_storage_key'],
            'site/announcements/backgrounds/980x31.webp',
        )
        self.assertEqual(rev['background']['overlay'], 'dark')

        public_id = created.data['public_id']
        published = self.client.post(
            reverse('site-admin-announcement-publish', kwargs={'public_id': public_id}),
            {'revision_token': created.data['revision_token'], 'revision': rev['number']},
            format='json',
        )
        self.assertEqual(published.status_code, status.HTTP_200_OK, published.data)
        self.assertEqual(published.data['lifecycle_state'], Announcement.LifecycleState.PUBLISHED)

        self.client.logout()
        feed = self.client.get(
            reverse('site-announcements-active'),
            {'surface': 'candidate', 'path': '/'},
        )
        self.assertEqual(feed.status_code, status.HTTP_200_OK, feed.data)
        item = next(
            entry for entry in feed.data['items'] if entry['public_id'] == public_id
        )
        self.assertEqual(item['theme']['mode'], 'preset')
        self.assertEqual(item['theme']['preset'], 'ocean')
        self.assertIn('image_url', item['background'])
        self.assertEqual(item['background']['fit'], 'cover')
        self.assertEqual(item['background']['overlay'], 'dark')
        # Public feed không lộ storage key.
        self.assertNotIn('image_storage_key', item['background'])

    def test_background_upload_accepts_strip_dimensions(self):
        upload = SimpleUploadedFile(
            'banner.png',
            _png_bytes(980, 31),
            content_type='image/png',
        )
        response = self.client.post(
            reverse('site-admin-announcement-backgrounds'),
            {'file': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data['path'].startswith('site/announcements/backgrounds/'))
        self.assertEqual(response.data['width'], 980)
        self.assertEqual(response.data['height'], 31)
        self.assertIn('url', response.data)

    def test_background_upload_rejects_too_tall_image(self):
        upload = SimpleUploadedFile(
            'tall.png',
            _png_bytes(980, 200),
            content_type='image/png',
        )
        response = self.client.post(
            reverse('site-admin-announcement-backgrounds'),
            {'file': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
