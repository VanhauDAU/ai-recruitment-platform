"""Public company page read model: detail, similar companies and job facets."""

import json

from django.core.cache import cache
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.jobs.models import Job, JobLocation
from apps.locations.models import Location

from ..models import Company, CompanyImage, CompanyIndustry, Industry
from ..page_registry import ACCENT_PALETTE, DEFAULT_ACCENT_KEY, MAIN_SECTIONS, SIDEBAR_SECTIONS
from .company_page_helpers import (
    add_recruiter,
    hold_company,
    make_company,
    make_employer,
    publish_job,
)

LIST_ITEM_KEYS = {
    'public_id',
    'slug',
    'company_name',
    'trade_name',
    'logo_url',
    'cover_image_url',
    'description_excerpt',
    'headquarters',
    'active_public_job_count',
    'company_size',
    'company_size_display',
    'industries_detail',
}


def _contrast_with_white(hex_colour):
    def channel(value):
        value /= 255
        return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4

    red, green, blue = (int(hex_colour[index : index + 2], 16) for index in (1, 3, 5))
    luminance = 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    return 1.05 / (luminance + 0.05)


class CompanyPageRegistryTests(SimpleTestCase):
    def test_default_layout_and_always_on_blocks(self):
        self.assertEqual(
            [section.key for section in MAIN_SECTIONS],
            ['about', 'jobs', 'benefits', 'culture', 'gallery', 'video'],
        )
        self.assertEqual(
            [section.key for section in SIDEBAR_SECTIONS],
            ['general_info', 'offices', 'social_links', 'share', 'similar_companies'],
        )
        self.assertEqual(
            {section.key for section in MAIN_SECTIONS + SIDEBAR_SECTIONS if section.always_on},
            {'jobs', 'general_info', 'share', 'similar_companies'},
        )

    def test_accent_palette_keeps_white_text_readable(self):
        self.assertEqual(
            ACCENT_PALETTE[DEFAULT_ACCENT_KEY],
            {'primary': '#00b14f', 'hover': '#008a3e', 'soft': '#f0fbf5'},
        )
        self.assertEqual(
            set(ACCENT_PALETTE),
            {'brand', 'ocean', 'indigo', 'violet', 'rose', 'orange', 'teal', 'slate'},
        )
        for key, accent in ACCENT_PALETTE.items():
            self.assertEqual(set(accent), {'primary', 'hover', 'soft'})
            if key == DEFAULT_ACCENT_KEY:
                # The platform colour is fixed by the brand, not chosen here.
                continue
            with self.subTest(accent=key):
                self.assertGreaterEqual(_contrast_with_white(accent['primary']), 4.5)


class PublicCompanyPageTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.creator = make_employer('company-page-creator@example.com')
        self.industry = Industry.objects.create(name='Công nghệ thông tin')

    def detail(self, company):
        return self.client.get(reverse('public-company-detail', args=[company.slug]))


class PublicCompanyDetailApiTests(PublicCompanyPageTestCase):
    def _rich_company(self):
        company = make_company(
            self.creator,
            name='Công ty TNHH Phần mềm Alpha',
            industry=self.industry,
            trade_name='Alpha Tech',
            tax_code='0101234567',
            email='private-contact@alpha.example',
            phone='0901234567',
            address='  17 Duy Tân, Cầu Giấy, Hà Nội  ',
            logo_url='employers/alpha/logo.png',
            cover_image_url='https://cdn.example.com/cover.png',
            website_url='https://www.alpha.example/careers',
            company_size=Company.Size.S100_499,
            founded_year=2010,
            description='<p>Xây dựng <strong>sản phẩm</strong> công nghệ.</p>',
            employee_benefits='<ul><li>Bảo hiểm sức khoẻ</li></ul>',
        )
        fintech = Industry.objects.create(name='Fintech')
        CompanyIndustry.objects.create(company=company, industry=fintech)
        CompanyImage.objects.create(
            company=company,
            image_url='employers/alpha/office.png',
            caption='Văn phòng',
        )
        self.representative = add_recruiter(company)
        publish_job(company, self.representative)
        return company

    def test_detail_contract_exposes_exactly_the_public_key_sets(self):
        company = self._rich_company()

        response = self.detail(company)

        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertSetEqual(
            set(data),
            {
                'public_id',
                'slug',
                'canonical_path',
                'indexable',
                'identity',
                'stats',
                'theme',
                'sections',
                'sidebar',
            },
        )
        self.assertEqual(data['public_id'], company.public_id)
        self.assertEqual(data['slug'], company.slug)
        self.assertEqual(data['canonical_path'], f'/cong-ty/{company.slug}')
        self.assertIs(data['indexable'], True)

        self.assertEqual(
            data['identity'],
            {
                'display_name': 'Alpha Tech',
                'legal_name': 'Công ty TNHH Phần mềm Alpha',
                'headline': '',
                'logo_url': 'http://testserver/media/employers/alpha/logo.png',
                'cover_image_url': 'https://cdn.example.com/cover.png',
                'website_url': 'https://www.alpha.example/careers',
                'industries': [
                    {
                        'id': self.industry.pk,
                        'name': 'Công nghệ thông tin',
                        'slug': self.industry.slug,
                        'is_primary': True,
                    },
                    {
                        'id': Industry.objects.get(name='Fintech').pk,
                        'name': 'Fintech',
                        'slug': 'fintech',
                        'is_primary': False,
                    },
                ],
            },
        )
        self.assertEqual(
            data['stats'],
            {
                'active_public_job_count': 1,
                'follower_count': 0,
                'company_size': '100-499',
                'company_size_display': '100 - 499 nhân viên',
                'founded_year': 2010,
            },
        )
        self.assertEqual(
            data['theme'],
            {
                'accent': {
                    'key': 'brand',
                    'primary': '#00b14f',
                    'hover': '#008a3e',
                    'soft': '#f0fbf5',
                }
            },
        )
        self.assertEqual(
            data['sections'],
            [
                {
                    'key': 'about',
                    'type': 'rich_text',
                    'title': 'Giới thiệu công ty',
                    'body_html': '<p>Xây dựng <strong>sản phẩm</strong> công nghệ.</p>',
                },
                {
                    'key': 'jobs',
                    'type': 'jobs',
                    'title': 'Việc làm đang tuyển',
                    'pinned_job_public_ids': [],
                },
                {
                    'key': 'benefits',
                    'type': 'benefits',
                    'title': 'Phúc lợi',
                    'items': [],
                    'body_html': '<ul><li>Bảo hiểm sức khoẻ</li></ul>',
                },
                {
                    'key': 'gallery',
                    'type': 'gallery',
                    'title': 'Hình ảnh công ty',
                    'items': [
                        {
                            'image_url': 'http://testserver/media/employers/alpha/office.png',
                            'caption': 'Văn phòng',
                        }
                    ],
                },
            ],
        )
        self.assertEqual(
            data['sidebar'],
            [
                {
                    'key': 'general_info',
                    'type': 'facts',
                    'title': 'Thông tin chung',
                    'items': [
                        {
                            'key': 'company_size',
                            'label': 'Quy mô',
                            'value': '100 - 499 nhân viên',
                        },
                        {
                            'key': 'industries',
                            'label': 'Lĩnh vực',
                            'value': 'Công nghệ thông tin, Fintech',
                        },
                        {'key': 'founded_year', 'label': 'Năm thành lập', 'value': '2010'},
                        {
                            'key': 'website',
                            'label': 'Website',
                            'value': 'alpha.example',
                            'href': 'https://www.alpha.example/careers',
                        },
                    ],
                },
                {
                    'key': 'offices',
                    'type': 'offices',
                    'title': 'Địa điểm',
                    'items': [
                        {
                            'label': 'Trụ sở chính',
                            'address': '17 Duy Tân, Cầu Giấy, Hà Nội',
                            'province_name': '',
                            'is_headquarters': True,
                        }
                    ],
                },
                {'key': 'share', 'type': 'share', 'title': 'Chia sẻ công ty'},
                {
                    'key': 'similar_companies',
                    'type': 'similar_companies',
                    'title': 'Công ty cùng lĩnh vực',
                },
            ],
        )

    def test_detail_never_leaks_private_company_or_recruiter_data(self):
        company = self._rich_company()
        hold_reason = 'Lý do kiểm duyệt nội bộ'
        company.page_events.create(
            event_type='policy_hold_released', payload={'reason': hold_reason}
        )

        payload = json.dumps(self.detail(company).data, ensure_ascii=False)

        for private_value in (
            '0101234567',
            'private-contact@alpha.example',
            '0901234567',
            self.representative.email,
            self.creator.email,
            hold_reason,
            'content_policy_hold',
            'policy_hold',
            'tax_code',
        ):
            with self.subTest(private_value=private_value):
                self.assertNotIn(private_value, payload)

    def test_sparse_company_keeps_only_the_always_on_blocks(self):
        company = make_company(self.creator, name='Công ty Sơ Sài')

        response = self.detail(company)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIs(response.data['indexable'], False)
        self.assertEqual(response.data['identity']['display_name'], 'Công ty Sơ Sài')
        self.assertEqual(response.data['identity']['legal_name'], '')
        self.assertEqual(response.data['identity']['logo_url'], '')
        self.assertEqual(response.data['identity']['industries'], [])
        self.assertEqual(
            response.data['stats'],
            {
                'active_public_job_count': 0,
                'follower_count': 0,
                'company_size': '',
                'company_size_display': '',
                'founded_year': None,
            },
        )
        self.assertEqual(
            response.data['sections'],
            [
                {
                    'key': 'jobs',
                    'type': 'jobs',
                    'title': 'Việc làm đang tuyển',
                    'pinned_job_public_ids': [],
                }
            ],
        )
        self.assertEqual(
            [block['key'] for block in response.data['sidebar']],
            ['general_info', 'share', 'similar_companies'],
        )
        self.assertEqual(response.data['sidebar'][0]['items'], [])

    def test_household_company_has_no_address_anywhere(self):
        home_address = 'Số 5 ngõ nhà riêng tuyệt đối không công khai'
        company = make_company(
            self.creator,
            name='Hộ kinh doanh Bình An',
            business_type=Company.BusinessType.HOUSEHOLD,
            address=home_address,
        )

        response = self.detail(company)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn('offices', [block['key'] for block in response.data['sidebar']])
        self.assertNotIn(home_address, json.dumps(response.data, ensure_ascii=False))

    def test_rich_text_without_visible_text_is_omitted(self):
        company = make_company(
            self.creator,
            name='Công ty Trống',
            description='<p> </p>',
            employee_benefits='<ul><li></li></ul>',
        )

        response = self.detail(company)

        self.assertEqual([section['key'] for section in response.data['sections']], ['jobs'])

    def test_website_is_linked_only_for_http_urls(self):
        company = make_company(
            self.creator,
            name='Công ty Liên Kết Lạ',
            website_url='javascript:alert(1)',
        )

        response = self.detail(company)

        self.assertEqual(response.data['identity']['website_url'], '')
        self.assertEqual(response.data['sidebar'][0]['items'], [])
        self.assertNotIn('javascript', json.dumps(response.data))

    def test_job_count_uses_the_canonical_public_predicate(self):
        company = make_company(self.creator, name='Công ty Đếm Tin', industry=self.industry)
        representative = add_recruiter(company)
        publish_job(company, representative)
        publish_job(company, representative, status=Job.Status.CLOSED)
        publish_job(company, representative, moderation_hold=Job.ModerationHold.MANUAL_REVIEW)

        response = self.detail(company)

        self.assertEqual(response.data['stats']['active_public_job_count'], 1)

    def test_unknown_and_held_company_answer_the_same_404(self):
        held = make_company(self.creator, name='Công ty Bị Ẩn', industry=self.industry)
        hold_company(held)
        urls = [
            reverse('public-company-detail', args=['khong-ton-tai']),
            reverse('public-company-detail', args=[held.slug]),
            reverse('public-company-similar', args=['co_unknown']),
            reverse('public-company-similar', args=[held.public_id]),
            reverse('public-company-job-facets', args=['co_unknown']),
            reverse('public-company-job-facets', args=[held.public_id]),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data, {'detail': 'Không tìm thấy công ty.'})

    def test_indexability_matrix(self):
        # (represented, industry, description, public job) -> indexable
        cases = [
            ((True, True, True, True), True),
            ((True, True, True, False), True),
            ((True, True, False, True), True),
            ((True, True, False, False), False),
            ((True, False, True, True), False),
            ((False, True, True, True), False),
        ]
        for index, (flags, expected) in enumerate(cases):
            represented, has_industry, has_description, has_job = flags
            company = make_company(
                self.creator,
                name=f'Công ty ma trận {index}',
                industry=self.industry if has_industry else None,
                description='<p>Giới thiệu công ty.</p>' if has_description else '',
            )
            recruiter = add_recruiter(company, approved=represented)
            if has_job:
                publish_job(company, recruiter)

            with self.subTest(flags=flags):
                self.assertIs(self.detail(company).data['indexable'], expected)


class PublicCompanySimilarApiTests(PublicCompanyPageTestCase):
    def similar(self, company):
        return self.client.get(reverse('public-company-similar', args=[company.public_id]))

    def test_similar_shares_primary_industry_and_ranks_hiring_companies_first(self):
        company = make_company(self.creator, name='Công ty Gốc', industry=self.industry)
        quiet = make_company(self.creator, name='A Công ty Im Lặng', industry=self.industry)
        hiring = make_company(self.creator, name='Z Công ty Đang Tuyển', industry=self.industry)
        publish_job(hiring, add_recruiter(hiring))
        other_industry = Industry.objects.create(name='Bán lẻ')
        make_company(self.creator, name='Công ty Ngành Khác', industry=other_industry)
        secondary = make_company(self.creator, name='Công ty Ngành Phụ', industry=other_industry)
        CompanyIndustry.objects.create(company=secondary, industry=self.industry)
        held = make_company(self.creator, name='Công ty Bị Ẩn', industry=self.industry)
        hold_company(held)

        response = self.similar(company)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(response.data), {'results'})
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [hiring.public_id, quiet.public_id],
        )
        self.assertEqual(
            [item['active_public_job_count'] for item in response.data['results']],
            [1, 0],
        )
        for item in response.data['results']:
            self.assertSetEqual(set(item), LIST_ITEM_KEYS)

    def test_similar_is_capped_at_six(self):
        company = make_company(self.creator, name='Công ty Gốc', industry=self.industry)
        for index in range(8):
            make_company(self.creator, name=f'Công ty cùng ngành {index}', industry=self.industry)

        response = self.similar(company)

        self.assertEqual(len(response.data['results']), 6)

    def test_company_without_primary_industry_has_no_similar_companies(self):
        company = make_company(self.creator, name='Công ty Chưa Chọn Ngành')
        make_company(self.creator, name='Công ty Có Ngành', industry=self.industry)

        response = self.similar(company)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {'results': []})


class PublicCompanyJobFacetsApiTests(PublicCompanyPageTestCase):
    def _ward(self, province, code):
        return Location.objects.create(
            code=code,
            level=Location.Level.WARD,
            name=f'Phường {code}',
            parent=province,
        )

    def test_facets_count_public_jobs_per_province(self):
        hanoi = Location.objects.create(code='01', level=Location.Level.PROVINCE, name='Hà Nội')
        danang = Location.objects.create(code='48', level=Location.Level.PROVINCE, name='Đà Nẵng')
        cantho = Location.objects.create(code='92', level=Location.Level.PROVINCE, name='Cần Thơ')
        hanoi_wards = [self._ward(hanoi, '00001'), self._ward(hanoi, '00002')]
        company = make_company(self.creator, name='Công ty Nhiều Văn Phòng')
        recruiter = add_recruiter(company)

        two_wards_one_province = publish_job(company, recruiter)
        for ward in hanoi_wards:
            JobLocation.objects.create(job=two_wards_one_province, location=ward)
        JobLocation.objects.create(job=two_wards_one_province, location=self._ward(danang, '20001'))
        JobLocation.objects.create(job=publish_job(company, recruiter), location=hanoi_wards[0])
        # Legacy rows may still point at the province itself.
        JobLocation.objects.create(job=publish_job(company, recruiter), location=cantho)
        closed = publish_job(company, recruiter, status=Job.Status.CLOSED)
        JobLocation.objects.create(job=closed, location=self._ward(danang, '20002'))
        other_company = make_company(self.creator, name='Công ty Khác')
        JobLocation.objects.create(
            job=publish_job(other_company, add_recruiter(other_company)),
            location=hanoi_wards[1],
        )

        response = self.client.get(reverse('public-company-job-facets', args=[company.public_id]))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {
                'locations': [
                    {'id': hanoi.pk, 'name': 'Hà Nội', 'count': 2},
                    {'id': cantho.pk, 'name': 'Cần Thơ', 'count': 1},
                    {'id': danang.pk, 'name': 'Đà Nẵng', 'count': 1},
                ]
            },
        )

    def test_company_without_public_jobs_has_no_facets(self):
        company = make_company(self.creator, name='Công ty Chưa Tuyển')

        response = self.client.get(reverse('public-company-job-facets', args=[company.public_id]))

        self.assertEqual(response.data, {'locations': []})


class PolicyHoldDirectoryTests(PublicCompanyPageTestCase):
    def _featured_company(self, name):
        company = make_company(
            self.creator,
            name=name,
            industry=self.industry,
            logo_url='https://cdn.example.com/logo.png',
            cover_image_url='https://cdn.example.com/cover.png',
        )
        publish_job(company, add_recruiter(company))
        return company

    def test_held_company_leaves_featured_and_search(self):
        visible = self._featured_company('Danh bạ Hiển Thị')
        held = self._featured_company('Danh bạ Bị Ẩn')
        hold_company(held)

        featured = self.client.get(reverse('public-company-list'))
        search = self.client.get(reverse('public-company-list'), {'q': 'danh ba'})

        self.assertEqual(
            [item['public_id'] for item in featured.data['results']],
            [visible.public_id],
        )
        self.assertEqual(search.data['count'], 1)
        self.assertEqual(
            [item['public_id'] for item in search.data['results']],
            [visible.public_id],
        )
