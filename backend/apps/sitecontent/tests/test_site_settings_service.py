from django.core.cache import cache
from django.test import TestCase

from apps.accounts.models import AdminAccessAuditLog, User

from ..models import SiteSetting
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

    def test_public_values_are_cached_and_exclude_private_settings(self):
        values = public_setting_values()

        self.assertEqual(values['test_tagline'], ('Cũ', False))
        self.assertNotIn('test_flag', values)
        self.assertEqual(cache.get(PUBLIC_SETTINGS_CACHE_KEY), values)
        with self.assertNumQueries(0):
            public_setting_values()
