from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase

from apps.accounts.models import AdminAccessAuditLog, User

from ..models import SiteSetting
from ..selectors import get_int_setting, get_setting, get_string_setting, setting_registry
from ..selectors.settings import SETTINGS_CACHE_KEY
from ..services import PUBLIC_SETTINGS_CACHE_KEY, public_setting_values, update_site_settings


class SiteSettingsServiceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.actor = User.objects.create_user(
            email='root@example.com', password='Password@123', role=User.Role.ADMIN
        )
        self.text = SiteSetting.objects.create(key='test_tagline', label='Tagline', value='Cũ')
        self.flag = SiteSetting.objects.create(
            key='test_flag',
            label='Cờ',
            value=False,
            value_type=SiteSetting.ValueType.BOOLEAN,
            is_public=False,
        )

    def test_valid_keys_are_saved_and_audited_while_invalid_keys_are_reported(self):
        result = update_site_settings(
            actor=self.actor,
            values={'test_tagline': 'Mới', 'test_flag': 'yes', 'missing_key': 1},
            image_uploads={},
        )

        self.assertEqual(result.updated, ['test_tagline'])
        self.assertEqual(result.values, {'test_tagline': 'Mới'})
        self.assertEqual(set(result.errors), {'test_flag', 'missing_key'})
        self.assertEqual(result.image_keys, [])
        self.text.refresh_from_db()
        self.assertEqual(self.text.value, 'Mới')
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                action='site_setting_update', target_public_id='test_tagline'
            ).exists()
        )

    def test_unchanged_value_counts_as_updated_without_audit(self):
        result = update_site_settings(
            actor=self.actor, values={'test_tagline': 'Cũ'}, image_uploads={}
        )

        self.assertEqual(result.updated, ['test_tagline'])
        self.assertFalse(AdminAccessAuditLog.objects.filter(action='site_setting_update').exists())

    def test_pattern_option_rejects_malformed_values_but_allows_blank(self):
        SiteSetting.objects.create(
            key='test_ga', label='GA', value='', options={'pattern': '^G-[A-Z0-9]{4,16}$'}
        )

        result = update_site_settings(
            actor=self.actor, values={'test_ga': 'UA-12345-1'}, image_uploads={}
        )
        self.assertIn('test_ga', result.errors)

        result = update_site_settings(actor=self.actor, values={'test_ga': ''}, image_uploads={})
        self.assertEqual(result.updated, ['test_ga'])

        result = update_site_settings(
            actor=self.actor, values={'test_ga': 'G-AB12CD34EF'}, image_uploads={}
        )
        self.assertEqual(result.values, {'test_ga': 'G-AB12CD34EF'})

    def test_public_values_are_cached_and_exclude_private_settings(self):
        values = public_setting_values()

        self.assertEqual(values['test_tagline'], ('Cũ', False))
        self.assertNotIn('test_flag', values)
        self.assertEqual(cache.get(PUBLIC_SETTINGS_CACHE_KEY), values)
        with self.assertNumQueries(0):
            public_setting_values()


class SettingSelectorTests(TestCase):
    def test_missing_row_falls_back_to_the_seed_default(self):
        SiteSetting.objects.filter(key='candidate_max_cvs').delete()

        default = setting_registry()['candidate_max_cvs']['value']
        self.assertEqual(get_setting('candidate_max_cvs'), default)
        self.assertEqual(get_int_setting('candidate_max_cvs', 99), default)
        self.assertIsNone(get_setting('not_a_setting'))

    def test_stored_value_wins_and_strings_are_trimmed(self):
        SiteSetting.objects.update_or_create(key='site_name', defaults={'value': '  Việc Tốt  '})
        SiteSetting.objects.update_or_create(key='support_email', defaults={'value': '   '})

        self.assertEqual(get_string_setting('site_name', 'ProCV'), 'Việc Tốt')
        self.assertEqual(get_string_setting('support_email', 'fallback'), 'fallback')

    def test_reads_inside_a_transaction_see_uncommitted_changes(self):
        cache.set(SETTINGS_CACHE_KEY, {'site_name': 'Cũ trong cache'})
        SiteSetting.objects.update_or_create(key='site_name', defaults={'value': 'Mới'})

        self.assertEqual(get_string_setting('site_name'), 'Mới')
        self.assertEqual(cache.get(SETTINGS_CACHE_KEY), {'site_name': 'Cũ trong cache'})


class SettingSelectorCacheTests(TransactionTestCase):
    def setUp(self):
        cache.clear()

    def test_committed_map_is_cached_until_the_next_commit(self):
        SiteSetting.objects.create(key='site_name', label='Tên', value='Một')

        self.assertEqual(get_string_setting('site_name'), 'Một')
        with self.assertNumQueries(0):
            self.assertEqual(get_string_setting('site_name'), 'Một')

        setting = SiteSetting.objects.get(key='site_name')
        setting.value = 'Hai'
        setting.save()

        self.assertEqual(get_string_setting('site_name'), 'Hai')


class ImageUploadAuditTests(TestCase):
    def test_image_upload_is_audited_with_before_and_after(self):
        actor = User.objects.create_user(
            email='root@example.com', password='Password@123', role=User.Role.ADMIN
        )
        SiteSetting.objects.update_or_create(
            key='seo_og_image',
            defaults={'value': '', 'value_type': SiteSetting.ValueType.IMAGE},
        )
        upload = SimpleUploadedFile('og.png', b'png', content_type='image/png')

        with patch(
            'apps.sitecontent.services.site_settings.save_image_upload',
            return_value={'path': 'site/settings/og.png'},
        ):
            result = update_site_settings(
                actor=actor, values={}, image_uploads={'seo_og_image': upload}
            )

        self.assertEqual(result.updated, ['seo_og_image'])
        log = AdminAccessAuditLog.objects.get(
            action='site_setting_update', target_public_id='seo_og_image'
        )
        self.assertEqual(log.payload, {'before': '', 'after': 'site/settings/og.png'})
