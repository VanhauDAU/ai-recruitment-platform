"""Cổng NTD/quản trị trên subdomain riêng: SEO theo host, link backend bỏ tiền tố."""

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from common.portal_paths import (
    admin_app_path,
    employer_app_path,
    employer_app_url,
    employer_marketing_path,
)

from ..selectors.legacy_paths import modernize_path_prefix

SHELL = (
    '<!doctype html><html lang="vi"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)
SUBDOMAINS = {
    'EMPLOYER_HOST': 'tuyendung.example.test',
    'ADMIN_HOST': 'quantri.example.test',
    'EMPLOYER_FRONTEND_URL': 'https://tuyendung.example.test',
    'EMPLOYER_MARKETING_BASE': '',
    'EMPLOYER_APP_BASE': '/app',
    'ADMIN_APP_BASE': '',
    'ALLOWED_HOSTS': ['testserver', 'tuyendung.example.test', 'quantri.example.test'],
}
EMPLOYER = {'HTTP_HOST': 'tuyendung.example.test'}


@override_settings(FRONTEND_SHELL_HTML=SHELL, **SUBDOMAINS)
class EmployerSubdomainSeoTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_marketing_pages_live_at_the_subdomain_root(self):
        home = self.client.get('/', **EMPLOYER)
        services = self.client.get('/dich-vu', **EMPLOYER)

        self.assertContains(home, 'Giải pháp tuyển dụng')
        self.assertContains(home, 'rel="canonical" href="http://tuyendung.example.test/"')
        self.assertNotContains(home, '"@type":"WebSite"')
        self.assertContains(services, 'href="http://tuyendung.example.test/dich-vu"')

    def test_old_main_domain_paths_redirect_to_the_subdomain(self):
        response = self.client.get('/tuyendung/dich-vu')

        self.assertEqual(response.status_code, 301)
        self.assertEqual(response['Location'], 'https://tuyendung.example.test/dich-vu')
        self.assertEqual(self.client.get('/dich-vu').status_code, 404)

    def test_robots_and_sitemaps_follow_the_host(self):
        robots = self.client.get('/robots.txt', **EMPLOYER).content.decode()
        admin_robots = self.client.get('/robots.txt', HTTP_HOST='quantri.example.test')
        employer_sitemap = self.client.get('/sitemaps/static.xml', **EMPLOYER)
        main_sitemap = self.client.get('/sitemaps/static.xml')

        self.assertIn('Disallow: /app/', robots)
        self.assertIn('Sitemap: http://tuyendung.example.test/sitemap.xml', robots)
        self.assertContains(admin_robots, 'Disallow: /\n')
        self.assertContains(employer_sitemap, 'http://tuyendung.example.test/dich-vu')
        self.assertNotContains(employer_sitemap, '/viec-lam')
        self.assertNotContains(main_sitemap, 'tuyendung')


class PortalPathTests(SimpleTestCase):
    def test_path_mode_keeps_the_prefixes(self):
        self.assertEqual(employer_app_path('/tong-quan'), '/tuyendung/app/tong-quan')
        self.assertEqual(employer_marketing_path(), '/tuyendung')
        self.assertEqual(admin_app_path('/loi-moi'), '/quan-tri/loi-moi')

    @override_settings(**SUBDOMAINS)
    def test_subdomain_mode_drops_the_prefixes(self):
        self.assertEqual(
            employer_app_url('/tong-quan'), 'https://tuyendung.example.test/app/tong-quan'
        )
        self.assertEqual(employer_marketing_path(), '/')
        self.assertEqual(admin_app_path(), '/')
        self.assertEqual(modernize_path_prefix('/tuyendung/app/dashboard'), '/app/tong-quan')
        self.assertEqual(modernize_path_prefix('/admin/app/accounts'), '/tai-khoan')
        self.assertEqual(modernize_path_prefix('/tuyendung'), '/')
