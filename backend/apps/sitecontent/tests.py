import shutil
import tempfile
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.accounts.models import User

from .models import Locale, SiteSetting
from .serializers import AdminSiteSettingSerializer


PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)
TEST_MEDIA_ROOT = tempfile.mkdtemp()
LOCAL_CACHE = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'sitecontent-tests',
    }
}


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'], CACHES=LOCAL_CACHE)
class SiteSettingImageUploadTests(APITransactionTestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(self.admin)
        self.old_path = default_storage.save('site/settings/old-logo.png', ContentFile(PNG_BYTES))
        self.setting = SiteSetting.objects.create(
            key='brand_logo_url',
            label='Logo đầy đủ',
            value=self.old_path,
            value_type=SiteSetting.ValueType.IMAGE,
        )

    def test_patch_with_image_file_replaces_setting_after_manual_save(self):
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.patch(
            reverse('site-admin-settings'),
            {'values': '{}', f'files[{self.setting.key}]': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], [self.setting.key])
        saved_value = response.data['values'][self.setting.key]
        self.assertTrue(saved_value.startswith('site/settings/'))
        self.assertNotIn('://', saved_value)
        self.assertIn('/media/site/settings/', response.data['display_values'][self.setting.key])
        self.setting.refresh_from_db()
        self.assertEqual(self.setting.value, saved_value)
        self.assertFalse(default_storage.exists(self.old_path))

    def test_legacy_upload_endpoint_no_longer_auto_saves_setting(self):
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('site-admin-settings-upload'),
            {'key': self.setting.key, 'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.setting.refresh_from_db()
        self.assertEqual(self.setting.value, self.old_path)

    def test_public_settings_resolves_storage_key_to_current_public_url(self):
        response = self.client.get(reverse('site-settings'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data[self.setting.key],
            f'http://testserver/media/{self.old_path}',
        )


class LocaleApiTests(APITransactionTestCase):
    def setUp(self):
        locale_rows = [
            ('vi-VN', 'Tiếng Việt', 'Tiếng Việt', 'mau-cv', True, 0),
            ('en-US', 'Tiếng Anh', 'English', 'mau-cv-tieng-anh', False, 10),
            ('ja-JP', 'Tiếng Nhật', '日本語', 'mau-cv-tieng-nhat', False, 20),
            ('zh-CN', 'Tiếng Trung', '简体中文', 'mau-cv-tieng-trung', False, 30),
        ]
        for code, label, native, path, is_default, order in locale_rows:
            Locale.objects.update_or_create(
                code=code,
                defaults={
                    'label_vi': label,
                    'native_name': native,
                    'catalog_path': path,
                    'is_default': is_default,
                    'sort_order': order,
                },
            )
        self.admin = User.objects.create_user(
            email='locale-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )

    def test_public_api_only_returns_active_locales_in_stable_order(self):
        Locale.objects.filter(code='ja-JP').update(is_active=False)
        response = self.client.get(reverse('site-locales'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['code'] for item in response.data], ['vi-VN', 'en-US', 'zh-CN'])

    def test_admin_can_change_default_and_previous_default_is_demoted(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            reverse('site-admin-locale-detail', kwargs={'code': 'en-US'}),
            {'is_default': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(Locale.objects.get(code='en-US').is_default)
        self.assertFalse(Locale.objects.get(code='vi-VN').is_default)

    def test_admin_cannot_deactivate_default_locale(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            reverse('site-admin-locale-detail', kwargs={'code': 'vi-VN'}),
            {'is_active': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AdminSiteSettingSerializerTests(APITransactionTestCase):
    @patch('apps.sitecontent.serializers.config', return_value='provider-secret')
    def test_env_badge_uses_decouple_and_never_exposes_secret(self, config):
        setting = SiteSetting.objects.create(
            key='ai_api_key_configured',
            label='API key',
            value_type=SiteSetting.ValueType.ENV,
            options={'env_var': 'GEMINI_API_KEY'},
        )

        data = AdminSiteSettingSerializer(setting).data

        self.assertTrue(data['env_configured'])
        self.assertNotIn('provider-secret', str(data))
        config.assert_called_once_with('GEMINI_API_KEY', default='')
