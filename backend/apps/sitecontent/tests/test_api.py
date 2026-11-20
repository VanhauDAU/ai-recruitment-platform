import shutil
import tempfile

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITransactionTestCase

from apps.accounts.models import User
from apps.sitecontent.services import PUBLIC_SETTINGS_CACHE_KEY
from common.storage.r2 import public_media_storage

from ..api.serializers import AdminSiteSettingSerializer
from ..models import SiteSetting

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


@override_settings(CACHES=LOCAL_CACHE)
class SiteSettingCacheInvalidationTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_cache_invalidation_waits_for_the_database_commit(self):
        cache.set(PUBLIC_SETTINGS_CACHE_KEY, {'brand_name': ('ProCV', False)}, 60)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            SiteSetting.objects.create(key='brand_name', label='Tên thương hiệu', value='ProCV')
            self.assertEqual(
                cache.get(PUBLIC_SETTINGS_CACHE_KEY),
                {'brand_name': ('ProCV', False)},
            )

        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        self.assertIsNone(cache.get(PUBLIC_SETTINGS_CACHE_KEY))

    def test_delete_is_deferred_and_rollback_keeps_the_committed_cache(self):
        setting = SiteSetting.objects.create(
            key='brand_name', label='Tên thương hiệu', value='ProCV'
        )
        committed = {'brand_name': ('ProCV', False)}
        cache.set(PUBLIC_SETTINGS_CACHE_KEY, committed, 60)

        with self.captureOnCommitCallbacks(execute=False) as delete_callbacks:
            setting.delete()
            self.assertEqual(cache.get(PUBLIC_SETTINGS_CACHE_KEY), committed)
        self.assertEqual(len(delete_callbacks), 1)
        delete_callbacks[0]()
        self.assertIsNone(cache.get(PUBLIC_SETTINGS_CACHE_KEY))

        setting = SiteSetting.objects.create(
            key='brand_name', label='Tên thương hiệu', value='ProCV'
        )
        cache.set(PUBLIC_SETTINGS_CACHE_KEY, committed, 60)
        with self.captureOnCommitCallbacks(execute=True) as rollback_callbacks:
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    setting.value = 'Rolled back'
                    setting.save(update_fields=['value', 'updated_at'])
                    raise RuntimeError('rollback')

        self.assertEqual(rollback_callbacks, [])
        self.assertEqual(cache.get(PUBLIC_SETTINGS_CACHE_KEY), committed)

    @override_settings(
        KNOWLEDGEBASE_PUBLIC_ENABLED=True,
        KNOWLEDGEBASE_SEARCH_INDEX_ENABLED=True,
    )
    def test_public_settings_exposes_backend_knowledgebase_capability(self):
        response = self.client.get(reverse('site-settings'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data['knowledgebase_public_enabled'], True)
        self.assertIs(response.data['knowledgebase_search_index_enabled'], True)

    @override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=False)
    def test_public_settings_capability_is_fail_closed_and_not_overridden_by_database(self):
        SiteSetting.objects.create(
            key='knowledgebase_public_enabled',
            label='Không dùng làm capability',
            value=True,
            value_type=SiteSetting.ValueType.BOOLEAN,
            is_public=True,
        )

        response = self.client.get(reverse('site-settings'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data['knowledgebase_public_enabled'], False)
        self.assertIs(response.data['knowledgebase_search_index_enabled'], False)


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
            is_superuser=True,
        )
        self.client.force_authenticate(self.admin)
        self.old_path = public_media_storage().save(
            'site/settings/old-logo.png', ContentFile(PNG_BYTES)
        )
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
        self.assertFalse(public_media_storage().exists(self.old_path))

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


class AdminSiteSettingSerializerTests(APITransactionTestCase):
    def test_exposes_seed_default_and_help_metadata(self):
        setting = SiteSetting.objects.create(
            key='site_name', label='Tên site', value='Riêng', section='Nhận diện', help='Giải thích'
        )

        data = AdminSiteSettingSerializer(setting).data

        self.assertEqual(data['default_value'], 'ProCV')
        self.assertEqual((data['section'], data['help']), ('Nhận diện', 'Giải thích'))


@override_settings(RECAPTCHA_SECRET_KEY='recaptcha-secret-value', EMAIL_HOST_USER='smtp-user@x.vn')
class AdminSystemParametersApiTests(APITransactionTestCase):
    def _client_for(self, **flags):
        user = User.objects.create_user(
            email=f'{len(flags)}@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            **flags,
        )
        self.client.force_authenticate(user)

    def test_superuser_reads_effective_values_without_secrets(self):
        self._client_for(is_superuser=True)

        response = self.client.get(reverse('site-admin-system-parameters'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = {item['key']: item for group in response.data['groups'] for item in group['items']}
        self.assertEqual(items['RECAPTCHA_SECRET_KEY']['value'], 'Đã cấu hình')
        self.assertEqual(items['AUTH_PASSWORD_VALIDATORS']['value'], '8 ký tự')
        self.assertNotIn('recaptcha-secret-value', str(response.data))
        self.assertNotIn('smtp-user@x.vn', str(response.data))

    def test_regular_admin_is_forbidden(self):
        self._client_for()

        response = self.client.get(reverse('site-admin-system-parameters'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminSiteSettingHistoryApiTests(APITransactionTestCase):
    def test_lists_this_keys_changes_newest_first(self):
        admin = User.objects.create_user(
            email='root@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        SiteSetting.objects.create(key='site_name', label='Tên', value='Một')
        SiteSetting.objects.create(key='hotline', label='Hotline', value='1')
        self.client.force_authenticate(admin)
        for values in ({'site_name': 'Hai'}, {'site_name': 'Ba', 'hotline': '2'}):
            self.client.patch(reverse('site-admin-settings'), {'values': values}, format='json')

        response = self.client.get(reverse('site-admin-setting-history', args=['site_name']))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        changes = [(row['before'], row['after']) for row in response.data['results']]
        self.assertEqual(changes, [('Hai', 'Ba'), ('Một', 'Hai')])
        self.assertEqual(response.data['results'][0]['actor'], 'root@example.com')
