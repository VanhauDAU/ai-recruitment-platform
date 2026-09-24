from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.jobs.models import Job
from common.throttling import ClientIPScopedRateThrottle

from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)


class PublicCompanyListApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.creator = get_user_model().objects.create_user(
            email='public-company-creator@example.com',
            password='Password@123',
            role='employer',
        )
        self.industry = Industry.objects.create(name='Công nghệ', slug='cong-nghe')
        self.sequence = 0
        self.representative_sequence = 0

    def _company(self, *, name, trade_name='', **overrides):
        self.sequence += 1
        values = {
            'company_name': name,
            'trade_name': trade_name,
            'tax_code': f'01{self.sequence:08d}',
            'created_by': self.creator,
        }
        values.update(overrides)
        return Company.objects.create(**values)

    def _approve_representative(
        self,
        company,
        *,
        method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
        document_types=None,
        document_status=CompanyDocument.Status.APPROVED,
        documents_current=True,
        account_status='active',
        case_status=EmployerVerificationCase.Status.APPROVED,
    ):
        self.representative_sequence += 1
        user = get_user_model().objects.create_user(
            email=(f'public-company-representative-{self.representative_sequence}@example.com'),
            password='Password@123',
            role='employer',
            status=account_status,
        )
        recruiter = RecruiterProfile.objects.create(
            user=user,
            company=company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        verification_case = EmployerVerificationCase.objects.create(
            recruiter=recruiter,
            company=company,
            verification_method=method,
            status=case_status,
        )
        if document_types is None:
            document_types = (
                (CompanyDocument.DocType.BUSINESS_REGISTRATION,)
                if method == EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
                else (
                    CompanyDocument.DocType.AUTHORIZATION_LETTER,
                    CompanyDocument.DocType.IDENTITY_DOCUMENT,
                )
            )
        for index, doc_type in enumerate(document_types):
            CompanyDocument.objects.create(
                company=company,
                recruiter=recruiter,
                uploaded_by=user,
                verification_case=verification_case,
                doc_type=doc_type,
                file_url=f'companies/{company.pk}/{doc_type}-{index}.pdf',
                status=document_status,
                is_current=documents_current,
            )
        return user

    def _public_job(self, company, posted_by, *, published_at=None, deadline=None, **overrides):
        values = {
            'posted_by': posted_by,
            'company': company,
            'title': f'Vị trí {company.pk}-{Job.objects.count()}',
            'description': 'Mô tả công việc công khai.',
            'status': Job.Status.ACTIVE,
            'published_at': published_at or timezone.now(),
            'deadline': deadline or timezone.localdate() + timedelta(days=30),
        }
        values.update(overrides)
        return Job.objects.create(**values)

    def _legal_company(self, *, name, trade_name='', **company_overrides):
        company = self._company(name=name, trade_name=trade_name, **company_overrides)
        representative = self._approve_representative(company)
        return company, representative

    def _featured_company(self, *, name, published_at=None, **company_overrides):
        values = {
            'logo_url': 'https://cdn.example.com/logo.png',
            'cover_image_url': 'https://cdn.example.com/cover.png',
            'description': '<p>Giới thiệu công ty.</p>',
            'company_size': Company.Size.S25_99,
        }
        values.update(company_overrides)
        company, representative = self._legal_company(name=name, **values)
        CompanyIndustry.objects.create(
            company=company,
            industry=self.industry,
            is_primary=True,
        )
        self._public_job(company, representative, published_at=published_at)
        return company, representative

    @patch('apps.employers.api.views.companies.random.shuffle')
    def test_anonymous_default_contract_is_public_safe_and_not_cached(self, shuffle):
        company, _representative = self._featured_company(
            name='Công ty Ánh Dương',
            trade_name='Ánh Dương Tech',
            description='<p>Xây dựng <strong>sản phẩm công nghệ</strong>.</p>',
            address='Tòa nhà Ánh Dương, Hà Nội',
        )

        response = self.client.get(
            reverse('public-company-list'),
            {'q': '   ', 'cursor': 'ignored'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response.data['next'], None)
        self.assertEqual(response.data['previous'], None)
        self.assertNotIn('count', response.data)
        self.assertEqual(len(response.data['results']), 1)
        shuffle.assert_called_once()
        result = response.data['results'][0]
        self.assertSetEqual(
            set(result),
            {
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
            },
        )
        self.assertEqual(result['public_id'], company.public_id)
        self.assertEqual(result['slug'], company.slug)
        self.assertEqual(result['logo_url'], 'https://cdn.example.com/logo.png')
        self.assertEqual(result['cover_image_url'], 'https://cdn.example.com/cover.png')
        self.assertEqual(result['description_excerpt'], 'Xây dựng sản phẩm công nghệ.')
        self.assertEqual(result['headquarters'], 'Tòa nhà Ánh Dương, Hà Nội')
        self.assertEqual(result['active_public_job_count'], 1)
        self.assertEqual(result['company_size'], Company.Size.S25_99)
        self.assertEqual(result['company_size_display'], '25 - 99 nhân viên')
        self.assertEqual(
            result['industries_detail'],
            [{'id': self.industry.pk, 'name': 'Công nghệ', 'slug': 'cong-nghe'}],
        )
        self.assertTrue(
            {
                'tax_code',
                'email',
                'phone',
                'address',
                'created_by',
                'recruiters',
            }.isdisjoint(result)
        )

    def test_search_does_not_apply_featured_verification_or_completeness_gates(self):
        business, _user = self._legal_company(name='Legal Business Registration')
        self._approve_representative(
            business,
            document_status=CompanyDocument.Status.PENDING,
        )

        authorization = self._company(name='Legal Authorization And Identity')
        self._approve_representative(
            authorization,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
        )

        missing_identity = self._company(name='Legal Missing Identity')
        self._approve_representative(
            missing_identity,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
            document_types=(CompanyDocument.DocType.AUTHORIZATION_LETTER,),
        )

        pending_document = self._company(name='Legal Pending Document')
        self._approve_representative(
            pending_document,
            document_status=CompanyDocument.Status.PENDING,
        )

        historical_document = self._company(name='Legal Historical Document')
        self._approve_representative(historical_document, documents_current=False)

        banned_account = self._company(name='Legal Banned Account')
        self._approve_representative(banned_account, account_status='banned')

        pending_case = self._company(name='Legal Pending Case')
        self._approve_representative(
            pending_case,
            case_status=EmployerVerificationCase.Status.PENDING,
        )

        revoked_case = self._company(name='Legal Revoked Case')
        self._approve_representative(
            revoked_case,
            case_status=EmployerVerificationCase.Status.REVOKED,
        )

        wrong_business_document = self._company(name='Legal Wrong Business Document')
        self._approve_representative(
            wrong_business_document,
            document_types=(CompanyDocument.DocType.AUTHORIZATION_LETTER,),
        )

        unknown_method = self._company(name='Legal Unknown Method')
        self._approve_representative(
            unknown_method,
            method='',
            document_types=(CompanyDocument.DocType.BUSINESS_REGISTRATION,),
        )

        split_evidence = self._company(name='Legal Split Evidence')
        self._approve_representative(
            split_evidence,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
            document_types=(CompanyDocument.DocType.AUTHORIZATION_LETTER,),
        )
        self._approve_representative(
            split_evidence,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
            document_types=(CompanyDocument.DocType.IDENTITY_DOCUMENT,),
        )

        deleted_account = self._company(name='Legal Deleted Account')
        deleted_user = self._approve_representative(deleted_account)
        deleted_user.is_deleted = True
        deleted_user.save(update_fields=['is_deleted'])

        response = self.client.get(reverse('public-company-list'), {'q': 'legal'})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        expected_ids = list(
            Company.objects.filter(company_name__startswith='Legal')
            .order_by('slug')
            .values_list('public_id', flat=True)
        )
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            expected_ids,
        )
        self.assertEqual(response.data['count'], len(expected_ids))

    def test_search_finds_unverified_incomplete_viettel_solutions(self):
        company = self._company(name='Viettel Solutions')

        response = self.client.get(reverse('public-company-list'), {'q': 'Viettel S'})
        featured = self.client.get(reverse('public-company-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [company.public_id],
        )
        result = response.data['results'][0]
        self.assertEqual(result['company_name'], 'Viettel Solutions')
        self.assertEqual(result['logo_url'], '')
        self.assertEqual(result['cover_image_url'], '')
        self.assertEqual(result['industries_detail'], [])
        self.assertEqual(result['active_public_job_count'], 0)
        self.assertNotIn(
            company.public_id, [item['public_id'] for item in featured.data['results']]
        )

    def test_headquarters_redacts_household_address_and_keeps_enterprise_address(self):
        enterprise, _enterprise_user = self._legal_company(
            name='Location Enterprise',
            address='  123 Nguyễn Trãi, Hà Nội  ',
        )
        household, _household_user = self._legal_company(
            name='Location Household',
            business_type=Company.BusinessType.HOUSEHOLD,
            address='Địa chỉ nhà riêng tuyệt đối không công khai',
        )

        response = self.client.get(reverse('public-company-list'), {'q': 'location'})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = {item['public_id']: item for item in response.data['results']}
        self.assertEqual(results[enterprise.public_id]['headquarters'], '123 Nguyễn Trãi, Hà Nội')
        self.assertEqual(results[household.public_id]['headquarters'], '')
        self.assertNotIn('Địa chỉ nhà riêng tuyệt đối không công khai', str(response.data))
        self.assertEqual(results[enterprise.public_id]['active_public_job_count'], 0)
        self.assertEqual(results[household.public_id]['active_public_job_count'], 0)

    @patch('apps.employers.api.views.companies.random.shuffle')
    def test_active_public_job_count_uses_canonical_availability(self, _shuffle):
        company, representative = self._featured_company(name='Công ty Đếm Tin Canonical')
        self._public_job(
            company,
            representative,
            deadline=timezone.localdate() - timedelta(days=1),
        )
        self._public_job(
            company,
            representative,
            moderation_hold=Job.ModerationHold.MANUAL_REVIEW,
        )

        search_response = self.client.get(
            reverse('public-company-list'),
            {'q': 'dem tin canonical'},
        )
        default_response = self.client.get(reverse('public-company-list'))

        self.assertEqual(search_response.status_code, status.HTTP_200_OK, search_response.data)
        self.assertEqual(default_response.status_code, status.HTTP_200_OK, default_response.data)
        self.assertEqual(search_response.data['results'][0]['active_public_job_count'], 1)
        self.assertEqual(default_response.data['results'][0]['active_public_job_count'], 1)

    def test_default_requires_logo_cover_and_industry_but_search_does_not(self):
        variants = (
            ('logo', '', 'https://cdn.example.com/cover.png', True),
            ('cover', 'https://cdn.example.com/logo.png', '', True),
            (
                'industry',
                'https://cdn.example.com/logo.png',
                'https://cdn.example.com/cover.png',
                False,
            ),
        )
        companies = []
        for label, logo_url, cover_image_url, has_industry in variants:
            company, representative = self._legal_company(
                name=f'Công ty Gate {label}',
                logo_url=logo_url,
                cover_image_url=cover_image_url,
            )
            if has_industry:
                CompanyIndustry.objects.create(company=company, industry=self.industry)
            self._public_job(company, representative)
            companies.append(company)

        default_response = self.client.get(reverse('public-company-list'))

        self.assertEqual(default_response.status_code, status.HTTP_200_OK)
        self.assertEqual(default_response.data['results'], [])
        for company in companies:
            with self.subTest(company=company.company_name):
                search_response = self.client.get(
                    reverse('public-company-list'),
                    {'q': company.company_name},
                )
                self.assertEqual(search_response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    [item['public_id'] for item in search_response.data['results']],
                    [company.public_id],
                )

    def test_default_uses_canonical_public_job_availability(self):
        company, representative = self._legal_company(
            name='Công ty Tin Hết Hạn',
            logo_url='https://cdn.example.com/logo.png',
            cover_image_url='https://cdn.example.com/cover.png',
        )
        CompanyIndustry.objects.create(company=company, industry=self.industry)
        self._public_job(
            company,
            representative,
            deadline=timezone.localdate() - timedelta(days=1),
        )

        default_response = self.client.get(reverse('public-company-list'))
        search_response = self.client.get(
            reverse('public-company-list'),
            {'q': 'tin het han'},
        )

        self.assertEqual(default_response.status_code, status.HTTP_200_OK)
        self.assertEqual(default_response.data['results'], [])
        self.assertEqual(
            [item['public_id'] for item in search_response.data['results']],
            [company.public_id],
        )
        self.assertEqual(search_response.data['results'][0]['active_public_job_count'], 0)

    @patch('apps.employers.api.views.companies.random.shuffle')
    def test_default_ranks_pool_before_shuffle_and_limits_to_eighteen(self, shuffle):
        now = timezone.now()
        companies = []
        for index in range(19):
            company, representative = self._featured_company(
                name=f'Công ty xếp hạng {index:02d}',
                published_at=now - timedelta(hours=index),
            )
            companies.append(company)
            if index == 18:
                self._public_job(
                    company,
                    representative,
                    published_at=now - timedelta(days=30),
                )

        response = self.client.get(reverse('public-company-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['next'], None)
        self.assertEqual(len(response.data['results']), 18)
        received = [item['public_id'] for item in response.data['results']]
        expected = [companies[18].public_id, *[company.public_id for company in companies[:17]]]
        self.assertEqual(received, expected)
        self.assertNotIn(companies[17].public_id, received)
        shuffle.assert_called_once()

    @patch('apps.employers.api.views.companies.random.shuffle')
    def test_default_shuffle_is_applied_to_ranked_featured_pool(self, shuffle):
        published_at = timezone.now()
        companies = [
            self._featured_company(
                name=f'Công ty ngẫu nhiên {index}',
                published_at=published_at,
            )[0]
            for index in range(3)
        ]
        shuffle.side_effect = lambda rows: rows.reverse()

        response = self.client.get(reverse('public-company-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [company.public_id for company in reversed(companies)],
        )

    def test_search_is_accent_insensitive_for_company_and_trade_names_only(self):
        company, _user = self._legal_company(
            name='Công ty Thương mại Ánh Dương',
            trade_name='Mặt Trời Việt',
        )
        unverified = self._company(name='Ánh Dương chưa xác thực')

        expectations = {
            'anh duong': [
                item.public_id for item in sorted((company, unverified), key=lambda item: item.slug)
            ],
            'mat troi': [company.public_id],
        }
        for query, expected_ids in expectations.items():
            with self.subTest(query=query):
                response = self.client.get(reverse('public-company-list'), {'q': query})
                self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                self.assertEqual(
                    [item['public_id'] for item in response.data['results']],
                    expected_ids,
                )

        tax_code_response = self.client.get(
            reverse('public-company-list'),
            {'q': company.tax_code},
        )
        self.assertEqual(tax_code_response.status_code, status.HTTP_200_OK)
        self.assertEqual(tax_code_response.data['results'], [])

    def test_search_rejects_queries_longer_than_120_characters(self):
        response = self.client.get(reverse('public-company-list'), {'q': 'a' * 121})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('q', response.data)

    def test_public_endpoint_is_throttled_by_trusted_client_ip(self):
        url = reverse('public-company-list')
        try:
            with patch.dict(
                ClientIPScopedRateThrottle.THROTTLE_RATES,
                {'public_companies': '2/min'},
            ):
                responses = [
                    self.client.get(
                        url,
                        {'q': 'company'},
                        REMOTE_ADDR='198.51.100.20',
                        HTTP_X_FORWARDED_FOR=f'203.0.113.{index}',
                    )
                    for index in range(3)
                ]
                other_client = self.client.get(
                    url,
                    {'q': 'company'},
                    REMOTE_ADDR='198.51.100.21',
                )
        finally:
            cache.clear()

        self.assertEqual(
            [response.status_code for response in responses],
            [status.HTTP_200_OK, status.HTTP_200_OK, status.HTTP_429_TOO_MANY_REQUESTS],
        )
        self.assertEqual(other_client.status_code, status.HTTP_200_OK)

    def test_public_search_names_are_folded_and_indexed(self):
        company, _representative = self._legal_company(
            name='Công ty Tên Ban Đầu',
            trade_name='Nhãn Hiệu Cũ',
        )
        company.company_name = 'Công ty Đổi Tên Mới'
        company.trade_name = 'Nhãn Hiệu Mới'
        company.save(update_fields=['company_name', 'trade_name'])
        company.refresh_from_db()

        self.assertEqual(company.company_name_search, 'cong ty doi ten moi')
        self.assertEqual(company.trade_name_search, 'nhan hieu moi')
        indexes = {index.name: index for index in Company._meta.indexes}
        self.assertEqual(indexes['idx_company_name_trgm'].opclasses, ['gin_trgm_ops'])
        self.assertEqual(indexes['idx_trade_name_trgm'].opclasses, ['gin_trgm_ops'])

        by_company_name = self.client.get(
            reverse('public-company-list'),
            {'q': 'doi ten moi'},
        )
        by_trade_name = self.client.get(
            reverse('public-company-list'),
            {'q': 'nhan hieu moi'},
        )
        stale_name = self.client.get(
            reverse('public-company-list'),
            {'q': 'ten ban dau'},
        )

        self.assertEqual(
            [item['public_id'] for item in by_company_name.data['results']],
            [company.public_id],
        )
        self.assertEqual(
            [item['public_id'] for item in by_trade_name.data['results']],
            [company.public_id],
        )
        self.assertEqual(stale_name.data['results'], [])

    @patch('apps.employers.api.views.companies.random.shuffle')
    def test_cursor_is_used_only_for_nonblank_search_without_duplicates(self, shuffle):
        companies = [
            self._legal_company(name='Công ty trùng tên tìm kiếm')[0] for _index in range(20)
        ]

        first = self.client.get(reverse('public-company-list'), {'q': 'trung ten tim kiem'})

        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertEqual(len(first.data['results']), 18)
        self.assertEqual(first.data['count'], 20)
        self.assertIsNotNone(first.data['next'])
        self.assertIsNone(first.data['previous'])
        shuffle.assert_not_called()

        parsed = urlsplit(first.data['next'])
        self.assertEqual(parse_qs(parsed.query)['q'], ['trung ten tim kiem'])
        second = self.client.get(f'{parsed.path}?{parsed.query}')

        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)
        self.assertEqual(len(second.data['results']), 2)
        self.assertNotIn('count', second.data)
        self.assertIsNone(second.data['next'])
        self.assertIsNotNone(second.data['previous'])
        received_ids = [
            item['public_id'] for response in (first, second) for item in response.data['results']
        ]
        expected_ids = [
            company.public_id for company in sorted(companies, key=lambda item: item.slug)
        ]
        self.assertEqual(received_ids, expected_ids)
        self.assertEqual(len(received_ids), len(set(received_ids)))

    def test_empty_search_returns_exact_zero_count(self):
        response = self.client.get(
            reverse('public-company-list'),
            {'q': 'khong co cong ty nao nhu vay'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])
        self.assertIsNone(response.data['next'])
        self.assertIsNone(response.data['previous'])
