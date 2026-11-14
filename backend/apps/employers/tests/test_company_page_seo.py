"""SEO shell and sitemap of the public company page."""

import json
import re

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import resolve, reverse

from apps.sitecontent.models import SiteSetting

from ..models import Company, Industry
from .company_page_helpers import (
    add_recruiter,
    hold_company,
    make_company,
    make_employer,
    publish_job,
)

SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)
JSON_LD_PATTERN = re.compile(
    r'<script data-seo-managed="server" type="application/ld\+json">(.*?)</script>',
    re.DOTALL,
)


def _structured_data(html):
    payload = json.loads(JSON_LD_PATTERN.search(html).group(1))
    return {item['@type']: item for item in payload['@graph']}


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class CompanySeoShellTests(TestCase):
    def setUp(self):
        cache.clear()
        self.creator = make_employer('company-seo-creator@example.com')
        self.industry = Industry.objects.create(name='Công nghệ thông tin')

    def _indexable_company(self, **overrides):
        values = {
            'name': 'Công ty TNHH Phần mềm Alpha',
            'trade_name': 'Alpha Tech',
            'industry': self.industry,
            'description': '<p>Xây dựng sản phẩm &amp; dịch vụ công nghệ.</p>',
        }
        values.update(overrides)
        company = make_company(self.creator, **values)
        add_recruiter(company)
        return company

    def shell(self, company):
        return self.client.get(reverse('seo-company-detail', args=[company.slug]))

    def test_indexable_company_has_title_description_canonical_and_robots(self):
        company = self._indexable_company()

        response = self.shell(company)

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            '<title data-seo-managed="server">Alpha Tech tuyển dụng | ProCV</title>',
        )
        self.assertContains(
            response,
            'name="description" content="Xây dựng sản phẩm &amp; dịch vụ công nghệ."',
        )
        self.assertContains(
            response,
            f'rel="canonical" href="http://testserver/cong-ty/{company.slug}"',
        )
        self.assertContains(response, 'name="robots" content="index, follow"')
        self.assertEqual(response['X-Robots-Tag'], 'index, follow')

    def test_long_description_is_truncated_and_missing_one_falls_back(self):
        long_company = self._indexable_company(
            name='Công ty Mô Tả Dài',
            trade_name='',
            description=f'<p>{"Mô tả rất dài. " * 40}</p>',
        )
        bare_company = make_company(self.creator, name='Công ty Chưa Có Mô Tả')

        long_html = self.shell(long_company).content.decode()
        bare_response = self.shell(bare_company)

        description = re.search(r'name="description" content="([^"]*)"', long_html).group(1)
        self.assertLessEqual(len(description), 160)
        self.assertTrue(description.endswith('…'))
        self.assertContains(
            bare_response,
            'content="Tìm hiểu Công ty Chưa Có Mô Tả và các việc làm đang tuyển."',
        )

    def test_thin_company_page_renders_but_is_not_indexed(self):
        company = make_company(self.creator, name='Công ty Sơ Sài')

        response = self.shell(company)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
        self.assertContains(response, 'name="robots" content="noindex, nofollow"')

    def test_site_wide_switch_overrides_an_indexable_company(self):
        company = self._indexable_company()
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

        response = self.shell(company)

        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')

    def test_unknown_and_held_slug_are_real_noindex_404(self):
        held = self._indexable_company()
        hold_company(held)

        for slug in ('khong-ton-tai', held.slug):
            with self.subTest(slug=slug):
                response = self.client.get(reverse('seo-company-detail', args=[slug]))

                self.assertEqual(response.status_code, 404)
                self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
                self.assertNotContains(response, 'Alpha Tech', status_code=404)
                self.assertNotContains(response, 'application/ld+json', status_code=404)

    def test_social_image_falls_back_from_cover_to_logo_to_site_default(self):
        with_cover = self._indexable_company(
            name='Công ty Có Bìa',
            cover_image_url='https://cdn.example.com/cover.png',
            logo_url='https://cdn.example.com/logo.png',
        )
        with_logo = self._indexable_company(
            name='Công ty Có Logo',
            logo_url='employers/logo-only/logo.png',
        )
        without_media = self._indexable_company(name='Công ty Không Ảnh')

        self.assertContains(
            self.shell(with_cover),
            'property="og:image" content="https://cdn.example.com/cover.png"',
        )
        self.assertContains(
            self.shell(with_logo),
            'name="twitter:image" content="http://testserver/media/employers/logo-only/logo.png"',
        )
        self.assertContains(
            self.shell(without_media),
            'property="og:image" content="http://testserver/images/logo/logo-full.webp"',
        )

    def test_organization_structured_data_is_public_safe(self):
        company = self._indexable_company(
            tax_code='0101234567',
            email='private-contact@alpha.example',
            phone='0901234567',
            address='17 Duy Tân, Cầu Giấy, Hà Nội',
            logo_url='https://cdn.example.com/logo.png',
            website_url='https://alpha.example',
            founded_year=2010,
        )

        html = self.shell(company).content.decode()

        self.assertEqual(
            _structured_data(html)['Organization'],
            {
                '@type': 'Organization',
                '@context': 'https://schema.org',
                'name': 'Alpha Tech',
                'legalName': 'Công ty TNHH Phần mềm Alpha',
                'url': f'http://testserver/cong-ty/{company.slug}',
                'logo': 'https://cdn.example.com/logo.png',
                'description': 'Xây dựng sản phẩm & dịch vụ công nghệ.',
                'foundingDate': '2010',
                'sameAs': 'https://alpha.example',
                'address': {
                    '@type': 'PostalAddress',
                    'streetAddress': '17 Duy Tân, Cầu Giấy, Hà Nội',
                    'addressCountry': 'VN',
                },
            },
        )
        for private_value in ('0101234567', 'private-contact@alpha.example', '0901234567'):
            self.assertNotIn(private_value, html)

    def test_sparse_organization_omits_every_optional_property(self):
        company = make_company(self.creator, name='Công ty Sơ Sài')

        organization = _structured_data(self.shell(company).content.decode())['Organization']

        self.assertEqual(
            organization,
            {
                '@type': 'Organization',
                '@context': 'https://schema.org',
                'name': 'Công ty Sơ Sài',
                'url': f'http://testserver/cong-ty/{company.slug}',
            },
        )

    def test_breadcrumb_structured_data_leads_back_to_the_directory(self):
        company = self._indexable_company()

        breadcrumb = _structured_data(self.shell(company).content.decode())['BreadcrumbList']

        self.assertEqual(
            [
                (item['position'], item['name'], item['item'])
                for item in breadcrumb['itemListElement']
            ],
            [
                (1, 'Trang chủ', 'http://testserver/'),
                (2, 'Công ty', 'http://testserver/cong-ty'),
                (3, 'Alpha Tech', f'http://testserver/cong-ty/{company.slug}'),
            ],
        )

    def test_household_address_never_reaches_the_shell(self):
        home_address = 'Số 5 ngõ nhà riêng tuyệt đối không công khai'
        company = self._indexable_company(
            name='Hộ kinh doanh Bình An',
            trade_name='',
            business_type=Company.BusinessType.HOUSEHOLD,
            address=home_address,
        )

        html = self.shell(company).content.decode()

        self.assertNotIn('address', _structured_data(html)['Organization'])
        self.assertNotIn(home_address, html)

    def test_company_name_cannot_break_out_of_the_head(self):
        hostile_name = 'Evil </script><script>alert(1)</script> Co'
        company = self._indexable_company(name=hostile_name, trade_name='')

        html = self.shell(company).content.decode()

        self.assertNotIn('<script>alert(1)', html)
        self.assertNotIn('</script><script>', html)
        self.assertEqual(html.count('<script'), 1)
        self.assertEqual(_structured_data(html)['Organization']['name'], hostile_name)

    def test_sitemap_lists_only_indexable_companies_with_lastmod(self):
        indexable = self._indexable_company()
        hiring_without_description = self._indexable_company(
            name='Công ty Đang Tuyển',
            trade_name='',
            description='',
        )
        publish_job(hiring_without_description, add_recruiter(hiring_without_description))
        thin = make_company(self.creator, name='Công ty Sơ Sài', industry=self.industry)
        held = self._indexable_company(name='Công ty Bị Ẩn', trade_name='')
        hold_company(held)

        sitemap = self.client.get(reverse('seo-sitemap-companies'))
        index = self.client.get(reverse('seo-sitemap-index'))

        self.assertEqual(sitemap.status_code, 200)
        self.assertEqual(reverse('seo-sitemap-companies'), '/sitemaps/companies.xml')
        indexable.refresh_from_db()
        self.assertContains(
            sitemap,
            f'<url><loc>http://testserver/cong-ty/{indexable.slug}</loc>'
            f'<lastmod>{indexable.updated_at.date().isoformat()}</lastmod></url>',
        )
        self.assertContains(sitemap, f'/cong-ty/{hiring_without_description.slug}<')
        self.assertNotContains(sitemap, thin.slug)
        self.assertNotContains(sitemap, held.slug)
        self.assertContains(index, 'http://testserver/sitemaps/companies.xml')

    def test_directory_routes_still_resolve_to_sitecontent(self):
        self.assertEqual(resolve('/cong-ty/tim-kiem').url_name, 'seo-company-search')
        self.assertEqual(resolve('/cong-ty/tim-kiem/').url_name, 'seo-company-search')
        self.assertEqual(resolve('/cong-ty').url_name, 'seo-company-directory')
        self.assertEqual(resolve('/cong-ty/alpha-tech').url_name, 'seo-company-detail')

        response = self.client.get('/cong-ty/tim-kiem')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Tìm kiếm công ty')
