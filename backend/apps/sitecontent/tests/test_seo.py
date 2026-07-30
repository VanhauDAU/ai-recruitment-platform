from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.sitecontent.models import SiteSetting

SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class SiteSeoTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_home_has_website_metadata_and_sitemap_index(self):
        response = self.client.get(reverse('seo-home'))
        sitemap = self.client.get(reverse('seo-sitemap-index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'application/ld+json')
        self.assertContains(response, '"@type":"WebSite"')
        self.assertContains(response, 'rel="canonical" href="http://testserver/"')
        self.assertContains(sitemap, '/sitemaps/jobs.xml')
        self.assertContains(sitemap, '/sitemaps/blog.xml')

    def test_global_index_switch_updates_robots_and_html_header(self):
        SiteSetting.objects.update_or_create(
            key='seo_robots_index',
            defaults={
                'label': 'Index',
                'group': SiteSetting.Group.SEO,
                'value_type': SiteSetting.ValueType.BOOLEAN,
                'value': False,
            },
        )
        cache.clear()

        robots = self.client.get(reverse('seo-robots'))
        home = self.client.get(reverse('seo-home'))

        self.assertContains(robots, 'Disallow: /')
        self.assertEqual(home['X-Robots-Tag'], 'noindex, nofollow')
