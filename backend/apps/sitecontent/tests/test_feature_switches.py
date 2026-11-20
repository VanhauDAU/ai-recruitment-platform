"""Công tắc admin chỉ thu hẹp được kill switch máy chủ (ADR-0026)."""

from django.core.cache import cache
from django.test import TestCase, override_settings

from ..models import SiteSetting
from ..selectors import (
    knowledgebase_public_enabled,
    knowledgebase_search_index_enabled,
    remote_announcements_enabled,
    setting_registry,
)
from ..services.seo import SEO_SETTING_DEFAULTS, resolved_seo_settings
from .test_seo import SHELL


def _set(key, value, value_type=SiteSetting.ValueType.BOOLEAN):
    SiteSetting.objects.update_or_create(
        key=key, defaults={'value': value, 'value_type': value_type}
    )


class FeatureSwitchTests(TestCase):
    @override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=True, KNOWLEDGEBASE_SEARCH_INDEX_ENABLED=True)
    def test_admin_can_close_the_help_center_the_server_allows(self):
        self.assertTrue(knowledgebase_public_enabled())
        self.assertTrue(knowledgebase_search_index_enabled())

        _set('knowledgebase_search_index_enabled', False)
        self.assertTrue(knowledgebase_public_enabled())
        self.assertFalse(knowledgebase_search_index_enabled())

        _set('knowledgebase_public_enabled', False)
        self.assertFalse(knowledgebase_public_enabled())
        self.assertEqual(self.client.get('/api/public/knowledgebase/categories/').status_code, 404)

    @override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=False)
    def test_admin_cannot_open_what_the_server_keeps_closed(self):
        _set('knowledgebase_public_enabled', True)

        self.assertFalse(knowledgebase_public_enabled())

    @override_settings(ANNOUNCEMENT_REMOTE_ENABLED_SURFACES=('candidate', 'admin_workspace'))
    def test_announcement_surfaces_narrow_the_server_list(self):
        self.assertTrue(remote_announcements_enabled('candidate'))
        self.assertFalse(remote_announcements_enabled('employer_workspace'))

        _set('announcement_surfaces', ['admin_workspace', 'employer_workspace'], 'multiselect')
        self.assertFalse(remote_announcements_enabled('candidate'))
        self.assertFalse(remote_announcements_enabled('employer_workspace'))
        self.assertTrue(remote_announcements_enabled('admin_workspace'))


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class SeoSettingsTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_defaults_match_the_seed(self):
        registry = setting_registry()
        for key, value in SEO_SETTING_DEFAULTS.items():
            with self.subTest(key=key):
                self.assertEqual(value, registry[key]['value'])

    def test_uploaded_images_resolve_to_public_media_urls(self):
        _set('seo_og_image', 'site/settings/og.png', SiteSetting.ValueType.IMAGE)

        self.assertTrue(
            resolved_seo_settings()['seo_og_image'].endswith('/media/site/settings/og.png')
        )
        self.assertEqual(resolved_seo_settings()['brand_logo_url'], '/images/logo/logo-full.webp')

    def test_homepage_uses_the_configured_description(self):
        _set('seo_default_description', 'Mô tả do admin đặt.', SiteSetting.ValueType.TEXTAREA)

        response = self.client.get('/')

        self.assertContains(response, 'Mô tả do admin đặt.', status_code=response.status_code)
