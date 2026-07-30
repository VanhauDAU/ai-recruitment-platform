from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.cv_templates.models import CvTemplateLocalization
from apps.cv_templates.tests.factories import make_published_template

SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class CvTemplateSeoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.template, _version = make_published_template(
            name='CV Hiện đại',
            preview_url='/media/templates/modern.png',
        )
        CvTemplateLocalization.objects.create(
            template=cls.template,
            locale='vi-VN',
            display_name='CV Hiện đại',
            description='Mẫu CV rõ ràng và chuyên nghiệp.',
            seo_title='Mẫu CV hiện đại',
        )

    def setUp(self):
        cache.clear()

    def test_template_detail_has_localized_canonical_and_structured_data(self):
        response = self.client.get(f'/mau-cv/chi-tiet/{self.template.slug}')
        html = response.content.decode()

        self.assertEqual(response.status_code, 200)
        self.assertIn(f'http://testserver/mau-cv/chi-tiet/{self.template.slug}', html)
        self.assertIn('Mẫu CV hiện đại | ProCV', html)
        self.assertIn('"@type":"CreativeWork"', html)
        self.assertIn('"@type":"BreadcrumbList"', html)

    def test_legacy_detail_canonicalizes_and_sitemap_contains_published_template(self):
        legacy = self.client.get(f'/cv-templates/{self.template.slug}')
        sitemap = self.client.get(reverse('seo-sitemap-cv-templates'))

        self.assertContains(
            legacy,
            f'rel="canonical" href="http://testserver/mau-cv/chi-tiet/{self.template.slug}"',
        )
        self.assertContains(sitemap, f'/mau-cv/chi-tiet/{self.template.slug}')

    def test_unknown_template_is_real_noindex_404(self):
        response = self.client.get('/mau-cv/chi-tiet/khong-ton-tai')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
