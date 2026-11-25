"""Public job reads: catalog, search, list filters, detail visibility and tracking."""

from datetime import timedelta
from unittest.mock import ANY, patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.campaigns.models import RecruitmentCampaign
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready

from ..models import Job, JobCategory, JobEngagementDaily
from .factories import open_visibility_window


class JobCategoryApiTests(APITestCase):
    def test_category_catalog_is_returned_in_one_unpaginated_response(self):
        JobCategory.objects.create(name='Kế toán')
        JobCategory.objects.create(name='Lập trình')

        response = self.client.get(reverse('job-category-list'), {'all': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual({item['name'] for item in response.data}, {'Kế toán', 'Lập trình'})
        self.assertEqual(
            set(response.data[0]),
            {'id', 'name', 'logo_url', 'parent', 'category_type'},
        )


class JobSuggestionApiTests(APITestCase):
    def test_suggest_returns_matching_active_job_titles(self):
        user = User.objects.create_user(
            email='suggest-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(company_name='Acme', created_by=user)
        make_employer_ready(user, company=company, candidate_data=True)
        Job.objects.create(
            posted_by=user,
            company=company,
            title='Nhân viên chăm sóc khách hàng',
            description='Description',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

        response = self.client.get(reverse('job-suggest'), {'q': 'nhan'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['suggestions'], ['Nhân viên chăm sóc khách hàng'])

    def test_folded_title_follows_renames_and_drives_search(self):
        user = User.objects.create_user(
            email='folded-title@example.com', password='Password@123', role=User.Role.EMPLOYER
        )
        company = Company.objects.create(company_name='Đông Á', created_by=user)
        make_employer_ready(user, company=company, candidate_data=True)
        job = Job.objects.create(
            posted_by=user,
            company=company,
            title='Kế toán tổng hợp',
            description='Description',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        job.title = 'Trưởng phòng Đào tạo'
        job.save(update_fields=['title'])
        job.refresh_from_db()
        self.assertEqual(job.title_search, 'truong phong dao tao')

        def search(**params):
            response = self.client.get(reverse('job-list'), params)
            return [item['slug'] for item in response.data['results']]

        self.assertEqual(search(search='ĐÀO tạo'), [job.slug])
        self.assertEqual(search(search='ke toan'), [])
        self.assertEqual(search(search='dong a', search_by='company'), [job.slug])
        self.assertEqual(search(search='dao dong', search_by='both'), [])
        suggestions = self.client.get(reverse('job-suggest'), {'q': 'dao', 'search_by': 'title'})
        self.assertEqual(suggestions.data['suggestions'], ['Trưởng phòng Đào tạo'])


class JobViewTrackingApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='view-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Views Inc.', created_by=self.user)
        self.recruiter = make_employer_ready(
            self.user,
            company=self.company,
            candidate_data=True,
        )
        self.job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Backend Engineer',
            description='Build reliable APIs.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

    def test_get_detail_has_no_view_count_side_effect(self):
        response = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 0)

    def test_detail_exposes_first_approval_as_the_stable_posted_date(self):
        first_approved_at = timezone.now() - timedelta(days=2)
        latest_published_at = timezone.now()
        self.job.first_approved_at = first_approved_at
        self.job.published_at = latest_published_at
        self.job.save(update_fields=['first_approved_at', 'published_at'])

        response = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(parse_datetime(response.data['first_approved_at']), first_approved_at)
        self.assertEqual(parse_datetime(response.data['published_at']), latest_published_at)

    def test_detail_links_company_by_slug_and_keeps_enterprise_address(self):
        Company.objects.filter(pk=self.company.pk).update(address='  12 Lý Thường Kiệt, Hà Nội  ')

        response = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['company_slug'], self.company.slug)
        self.assertEqual(response.data['company_address'], '12 Lý Thường Kiệt, Hà Nội')

    def test_held_company_takes_its_jobs_off_the_public_site(self):
        Company.objects.filter(pk=self.company.pk).update(content_policy_hold=True)

        detail = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))
        cards = self.client.get(reverse('job-list'))

        self.assertEqual(detail.status_code, 404)
        self.assertEqual(cards.data['results'], [])

    def test_detail_never_exposes_household_business_address(self):
        Company.objects.filter(pk=self.company.pk).update(
            business_type=Company.BusinessType.HOUSEHOLD,
            address='Địa chỉ nhà riêng không công khai',
        )

        response = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['company_address'], '')
        self.assertNotIn('Địa chỉ nhà riêng không công khai', str(response.data))

    def test_lifecycle_hides_job_outside_visibility_window(self):
        self.job.deadline = timezone.localdate() + timedelta(days=10)
        self.job.visibility_starts_at = timezone.now() - timedelta(days=10)
        self.job.visibility_ends_at = timezone.now() - timedelta(seconds=1)
        self.job.save(
            update_fields=['deadline', 'visibility_starts_at', 'visibility_ends_at', 'updated_at']
        )

        response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)

    def test_paused_campaign_hides_job_from_every_public_read_and_tracking_surface(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Visibility campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job.campaign = campaign
        self.job.save(update_fields=['campaign', 'updated_at'])

        visible_detail = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))
        visible_list = self.client.get(reverse('job-list'))
        visible_suggest = self.client.get(reverse('job-suggest'), {'q': 'Backend'})

        campaign.status = RecruitmentCampaign.Status.PAUSED
        campaign.save(update_fields=['status', 'updated_at'])
        hidden_detail = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))
        hidden_list = self.client.get(reverse('job-list'))
        hidden_suggest = self.client.get(reverse('job-suggest'), {'q': 'Backend'})
        hidden_tracking = self.client.post(
            reverse('job-view-create', kwargs={'slug': self.job.slug})
        )

        self.assertEqual(visible_detail.status_code, 200)
        self.assertEqual(visible_list.data['count'], 1)
        self.assertEqual(visible_suggest.data['suggestions'], [self.job.title])
        self.assertEqual(hidden_detail.status_code, 404)
        self.assertEqual(hidden_list.data['count'], 0)
        self.assertEqual(hidden_suggest.data['suggestions'], [])
        self.assertEqual(hidden_tracking.status_code, 404)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)

    def test_locked_employer_hides_job_from_every_public_read_and_tracking_surface(self):
        visible_detail = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))
        visible_list = self.client.get(reverse('job-list'))
        visible_suggest = self.client.get(reverse('job-suggest'), {'q': 'Backend'})

        self.user.status = User.Status.BANNED
        self.user.is_active = False
        self.user.save(update_fields=['status', 'is_active', 'updated_at'])

        hidden_detail = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))
        hidden_list = self.client.get(reverse('job-list'))
        hidden_suggest = self.client.get(reverse('job-suggest'), {'q': 'Backend'})
        hidden_tracking = self.client.post(
            reverse('job-view-create', kwargs={'slug': self.job.slug})
        )

        self.assertEqual(visible_detail.status_code, 200)
        self.assertEqual(visible_list.data['count'], 1)
        self.assertEqual(visible_suggest.data['suggestions'], [self.job.title])
        self.assertEqual(hidden_detail.status_code, 404)
        self.assertEqual(hidden_list.data['count'], 0)
        self.assertEqual(hidden_suggest.data['suggestions'], [])
        self.assertEqual(hidden_tracking.status_code, 404)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)

    def test_tracking_requires_analytics_consent_and_does_not_set_viewer_cookie(self):
        response = self.client.post(reverse('job-view-create', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reason'], 'consent_required')
        self.assertNotIn('procv_viewer_id', response.cookies)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 0)

    @patch(
        'apps.jobs.services.engagement._claim_first_views',
        side_effect=lambda groups: [True] * len(groups),
    )
    def test_first_consented_view_increments_once_and_sets_viewer_cookie(self, _claim_first_view):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )

        response = self.client.post(reverse('job-view-create', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'counted': True, 'view_count': 1})
        self.assertIn('procv_viewer_id', response.cookies)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 1)
        daily = JobEngagementDaily.objects.get(job=self.job)
        self.assertEqual(daily.view_count, 1)
        self.assertEqual(daily.impression_count, 0)

    def test_impression_batch_requires_analytics_consent(self):
        response = self.client.post(
            reverse('job-impression-batch-create'),
            {'slugs': [self.job.slug]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['reason'], 'consent_required')
        self.assertNotIn('procv_viewer_id', response.cookies)
        self.job.refresh_from_db()
        self.assertEqual(self.job.impression_count, 0)

    @patch(
        'apps.jobs.services.engagement._claim_first_views',
        side_effect=lambda groups: [True] * len(groups),
    )
    def test_consented_impression_batch_increments_lifetime_and_daily_counters(self, _claim):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )

        response = self.client.post(
            reverse('job-impression-batch-create'),
            {'slugs': [self.job.slug, self.job.slug, 'missing-job']},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data['results'],
            [
                {'slug': self.job.slug, 'counted': True},
                {'slug': 'missing-job', 'counted': False, 'reason': 'not_found'},
            ],
        )
        self.assertIn('procv_viewer_id', response.cookies)
        self.job.refresh_from_db()
        self.assertEqual(self.job.impression_count, 1)
        daily = JobEngagementDaily.objects.get(job=self.job)
        self.assertEqual(daily.impression_count, 1)

    @patch(
        'apps.jobs.services.engagement._claim_first_views',
        side_effect=lambda groups: [None] * len(groups),
    )
    def test_redis_failure_does_not_increment_impression(self, _claim):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )

        response = self.client.post(
            reverse('job-impression-batch-create'),
            {'slugs': [self.job.slug]},
            format='json',
        )

        self.assertEqual(response.data['results'][0]['reason'], 'redis_error')
        self.job.refresh_from_db()
        self.assertEqual(self.job.impression_count, 0)
        self.assertFalse(JobEngagementDaily.objects.filter(job=self.job).exists())

    @patch(
        'apps.jobs.services.engagement._claim_first_views',
        side_effect=lambda groups: [False] * len(groups),
    )
    def test_duplicate_impression_does_not_increment_counters(self, _claim):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )

        response = self.client.post(
            reverse('job-impression-batch-create'),
            {'slugs': [self.job.slug]},
            format='json',
        )

        self.assertEqual(response.data['results'][0]['reason'], 'duplicate')
        self.job.refresh_from_db()
        self.assertEqual(self.job.impression_count, 0)

    @patch(
        'apps.jobs.services.engagement._claim_first_views',
        side_effect=lambda groups: [True] * len(groups),
    )
    def test_impression_batch_writes_a_fixed_number_of_statements(self, _claim):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )
        jobs = [self.job] + [
            Job.objects.create(
                posted_by=self.user,
                company=self.company,
                title=f'Batch job {index}',
                description='Description',
                status=Job.Status.ACTIVE,
                **open_visibility_window(),
            )
            for index in range(5)
        ]
        slugs = [job.slug for job in jobs]

        def post(batch):
            return self.client.post(
                reverse('job-impression-batch-create'), {'slugs': batch}, format='json'
            )

        with CaptureQueriesContext(connection) as small:
            post(slugs[:1])
        with CaptureQueriesContext(connection) as large:
            post(slugs)

        self.assertEqual(len(large.captured_queries), len(small.captured_queries))
        # The second batch hits the existing daily row of the first job (upsert).
        self.assertEqual(
            dict(JobEngagementDaily.objects.values_list('job__slug', 'impression_count')),
            {slugs[0]: 2, **dict.fromkeys(slugs[1:], 1)},
        )
        self.assertEqual(
            set(
                Job.objects.filter(pk__in=[job.pk for job in jobs]).values_list(
                    'impression_count', flat=True
                )
            ),
            {1, 2},
        )

    def test_impression_batch_accepts_at_most_fifty_slugs(self):
        response = self.client.post(
            reverse('job-impression-batch-create'),
            {'slugs': [f'job-{index}' for index in range(51)]},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('slugs', response.data)


class JobSalaryBucketFilterTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)
        make_employer_ready(self.user, company=self.company, candidate_data=True)

    def create_job(self, title, salary_min, salary_max):
        return Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title=title,
            description='Description',
            salary_min=salary_min,
            salary_max=salary_max,
            salary_type=Job.SalaryType.RANGE,
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

    def test_homepage_under_10_bucket_uses_displayed_upper_salary(self):
        self.create_job('Under 10', 5_000_000, 9_000_000)
        self.create_job('Crosses 10', 8_000_000, 13_000_000)
        self.create_job('Starts at 10', 10_000_000, 25_000_000)

        response = self.client.get(reverse('job-list'), {'salary_bucket': 'u10'})

        self.assertEqual(response.status_code, 200)
        titles = {job['title'] for job in response.data['results']}
        self.assertEqual(titles, {'Under 10'})

    def test_urgent_ordering_uses_urgent_label_not_flash_badge(self):
        urgent = self.create_job('Urgent semantic', 10_000_000, 15_000_000)
        urgent.is_urgent = True
        urgent.save(update_fields=['is_urgent'])
        flash = self.create_job('Fast response badge', 10_000_000, 15_000_000)
        flash.has_flash_badge = True
        flash.save(update_fields=['has_flash_badge'])

        response = self.client.get(reverse('job-list'), {'ordering': 'urgent'})

        self.assertEqual(response.status_code, 200)
        titles = [job['title'] for job in response.data['results']]
        self.assertLess(titles.index('Urgent semantic'), titles.index('Fast response badge'))

    def test_unknown_ordering_is_rejected(self):
        self.create_job('Ordering validation', 10_000_000, 15_000_000)

        response = self.client.get(reverse('job-list'), {'ordering': 'unknown'})

        self.assertEqual(response.status_code, 400)
        self.assertIn('ordering', response.data)

    def test_list_contract_contains_card_fields_only(self):
        self.create_job('Contract job', 10_000_000, 15_000_000)

        response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        item = next(job for job in response.data['results'] if job['title'] == 'Contract job')
        self.assertEqual(
            set(item),
            {
                'public_id',
                'slug',
                'title',
                'company_name',
                'company_slug',
                'company_logo_url',
                'brand_slug',
                'company_verified',
                'category',
                'locations_detail',
                'job_skills',
                'work_type',
                'work_types',
                'employment_type',
                'education_level',
                'experience_years',
                'position_level',
                'age_min',
                'age_max',
                'salary_type',
                'salary_min',
                'salary_max',
                'income_display_type',
                'currency',
                'tier',
                'is_hot',
                'is_urgent',
                'has_flash_badge',
                'presentation',
                'first_approved_at',
                'published_at',
                'created_at',
            },
        )

    def test_company_filter_matches_public_id_exactly_not_company_name(self):
        other_user = User.objects.create_user(
            email='same-name-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        same_name_company = Company.objects.create(company_name='Acme', created_by=other_user)
        make_employer_ready(other_user, company=same_name_company, candidate_data=True)
        self.create_job('Acme original', 10_000_000, 15_000_000)
        Job.objects.create(
            posted_by=other_user,
            company=same_name_company,
            title='Acme namesake',
            description='Description',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

        response = self.client.get(reverse('job-list'), {'company': self.company.public_id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([job['title'] for job in response.data['results']], ['Acme original'])
        self.assertEqual(response.data['results'][0]['company_slug'], self.company.slug)

    def test_company_filter_with_unknown_public_id_returns_no_jobs(self):
        self.create_job('Visible elsewhere', 10_000_000, 15_000_000)

        response = self.client.get(reverse('job-list'), {'company': 'co_unknown'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])

    def test_list_exposes_first_approval_as_the_stable_posted_date(self):
        first_approved_at = timezone.now() - timedelta(days=2)
        latest_published_at = timezone.now()
        job = self.create_job('Reapproved job', 10_000_000, 15_000_000)
        job.first_approved_at = first_approved_at
        job.published_at = latest_published_at
        job.save(update_fields=['first_approved_at', 'published_at'])

        response = self.client.get(reverse('job-list'))

        item = next(item for item in response.data['results'] if item['public_id'] == job.public_id)
        self.assertEqual(parse_datetime(item['first_approved_at']), first_approved_at)
        self.assertEqual(parse_datetime(item['published_at']), latest_published_at)

    def test_list_presentation_is_semantic_and_keeps_legacy_fields_for_rollback(self):
        job = self.create_job('Presented job', 10_000_000, 15_000_000)
        job.tier = Job.Tier.FEATURED
        job.is_urgent = True
        job.has_flash_badge = True
        job.deadline = timezone.localdate() + timedelta(days=10)
        job.save(update_fields=['tier', 'is_urgent', 'has_flash_badge', 'deadline'])

        response = self.client.get(reverse('job-list'))

        item = next(job for job in response.data['results'] if job['title'] == 'Presented job')
        self.assertEqual(item['tier'], Job.Tier.FEATURED)
        self.assertEqual(
            item['presentation'],
            {
                'sponsored': True,
                'card_tone': 'orange',
                'labels': [
                    {'code': 'sponsored', 'text': 'Tài trợ', 'tone': 'sponsored'},
                    {'code': 'urgent', 'text': 'GẤP', 'tone': 'warning'},
                    {
                        'code': 'fast_response',
                        'text': 'Phản hồi nhanh',
                        'tone': 'success',
                    },
                ],
                'display_reason': '',
                'active_until': ANY,
                'placement': 'legacy_priority',
            },
        )
        self.assertTrue(
            {
                'description',
                'requirements',
                'benefits',
                'application_contact',
                'application_count',
                'status',
                'updated_at',
            }.isdisjoint(item)
        )


class EngagementDedupePipelineTests(APITestCase):
    def test_one_pipeline_claims_every_group_and_fails_closed_on_redis_errors(self):
        from redis.exceptions import RedisError

        from ..services import engagement

        class Pipeline:
            def __init__(self, results):
                self.calls, self.results = [], results

            def eval(self, script, key_count, *args):
                self.calls.append(args[:key_count])

            def execute(self):
                if isinstance(self.results, Exception):
                    raise self.results
                return self.results

        def fake_cache(pipeline):
            client = type('Client', (), {'pipeline': lambda self, transaction: pipeline})()
            backend = type('Backend', (), {'get_client': lambda self, write: client})()
            return type(
                'Cache', (), {'client': backend, 'make_key': staticmethod(lambda key: f'k:{key}')}
            )()

        pipeline = Pipeline([1, 0])
        with patch.object(engagement, 'cache', fake_cache(pipeline)):
            self.assertEqual(engagement._claim_first_views([['a'], ['b', 'c']]), [True, False])
        self.assertEqual(pipeline.calls, [('k:a',), ('k:b', 'k:c')])

        with patch.object(engagement, 'cache', fake_cache(Pipeline(RedisError()))):
            self.assertEqual(engagement._claim_first_views([['a'], ['b']]), [None, None])
