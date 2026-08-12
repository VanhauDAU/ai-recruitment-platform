from datetime import timedelta
from unittest.mock import ANY, patch

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.applications.models import Application
from apps.cvs.models import CvVersion, UserCv
from apps.employers.models import (
    Company,
    DpaStatus,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentCampaign,
)
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.locations.models import Location
from apps.skills.models import Skill, SkillGroup

from ..api.serializers import (
    EmployerJobDraftSerializer,
    EmployerJobWriteSerializer,
    JobDetailSerializer,
)
from ..models import Benefit, Job, JobCategory, JobEngagementDaily, Language


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
        )

        response = self.client.get(reverse('job-suggest'), {'q': 'nhan'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['suggestions'], ['Nhân viên chăm sóc khách hàng'])


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
        )

    def test_get_detail_has_no_view_count_side_effect(self):
        response = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 0)

    @override_settings(JOB_LIFECYCLE_V2_MODE='enforce')
    def test_enforced_lifecycle_hides_job_outside_visibility_window(self):
        self.job.deadline = timezone.localdate() + timedelta(days=10)
        self.job.visibility_starts_at = timezone.now() - timedelta(days=10)
        self.job.visibility_ends_at = timezone.now() - timedelta(seconds=1)
        self.job.save(
            update_fields=['deadline', 'visibility_starts_at', 'visibility_ends_at', 'updated_at']
        )

        response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)

    @override_settings(JOB_LIFECYCLE_V2_MODE='legacy')
    def test_legacy_lifecycle_ignores_shadow_visibility_window(self):
        self.job.deadline = timezone.localdate() + timedelta(days=10)
        self.job.visibility_starts_at = timezone.now() - timedelta(days=10)
        self.job.visibility_ends_at = timezone.now() - timedelta(seconds=1)
        self.job.save(
            update_fields=['deadline', 'visibility_starts_at', 'visibility_ends_at', 'updated_at']
        )

        response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

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

    @patch('apps.jobs.services.engagement._claim_first_view', return_value=True)
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

    @patch('apps.jobs.services.engagement._claim_first_view', return_value=True)
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

    @patch('apps.jobs.services.engagement._claim_first_view', return_value=None)
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

    @patch('apps.jobs.services.engagement._claim_first_view', return_value=False)
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
                'published_at',
                'created_at',
            },
        )

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


class EmployerJobSerializerTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='employer-write@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)
        self.recruiter = make_employer_ready(
            self.user,
            company=self.company,
            candidate_data=True,
        )
        self.province = Location.objects.create(
            code='01-test',
            level=Location.Level.PROVINCE,
            name='Thành phố Hà Nội',
        )
        self.ward = Location.objects.create(
            code='00001-test',
            level=Location.Level.WARD,
            name='Phường Cầu Giấy',
            parent=self.province,
        )
        self.specialization = JobCategory.objects.create(
            name='Chăm sóc khách hàng',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.domain = JobCategory.objects.create(
            name='Giáo dục / Đào tạo',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        self.skill_group = SkillGroup.objects.create(name='Chăm sóc khách hàng')
        self.skill = Skill.objects.create(name='Giao tiếp', group=self.skill_group)
        self.benefit, _ = Benefit.objects.get_or_create(name='Bảo hiểm xã hội')
        self.language, _ = Language.objects.get_or_create(name='Tiếng Hàn', code='ko')

    def test_employer_list_uses_compact_management_contract(self):
        Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Tin quản lý',
            description='Nội dung dài không thuộc response danh sách',
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse('employer-job-list-create'))

        self.assertEqual(response.status_code, 200)
        item = response.data['results'][0]
        self.assertEqual(
            set(item),
            {
                'public_id',
                'title',
                'company_name',
                'locations_detail',
                'employment_type',
                'deadline',
                'application_deadline',
                'requested_visibility_days',
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
                'is_visibility_expired',
                'status',
                'is_expired',
                'campaign',
                'campaign_name',
                'application_count',
                'candidate_count',
                'candidate_previews',
                'view_count',
                'published_at',
                'submitted_at',
                'approved_at',
                'rejected_reason',
                'created_at',
                'updated_at',
            },
        )
        self.assertTrue(
            {
                'description',
                'requirements',
                'benefits',
                'application_contact',
                'job_skills',
                'category_assignments',
            }.isdisjoint(item)
        )
        self.assertEqual(item['candidate_count'], 0)
        self.assertEqual(item['candidate_previews'], [])

    def test_posting_context_exposes_safe_lifecycle_rollout_contract(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse('employer-job-posting-context'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data['lifecycle_policy'],
            {
                'mode': 'legacy',
                'default_visibility_days': 30,
                'max_visibility_days': 90,
                'timezone': 'Asia/Ho_Chi_Minh',
            },
        )
        self.assertEqual(
            response.data['services'],
            {'catalog_v2_enabled': False, 'activation_enabled': False},
        )

    def test_new_or_dpa_held_employer_cannot_read_job_workspace_directly(self):
        legacy_user = User.objects.create_user(
            email='legacy-incomplete-job-reader@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        legacy_company = Company.objects.create(
            company_name='Legacy incomplete job company',
            created_by=legacy_user,
        )
        legacy_job = Job.objects.create(
            posted_by=legacy_user,
            company=legacy_company,
            title='Legacy inaccessible job',
        )
        self.client.force_authenticate(legacy_user)

        for url in (
            reverse('employer-job-list-create'),
            reverse('employer-job-detail', kwargs={'public_id': legacy_job.public_id}),
        ):
            with self.subTest(url=url, state='new'):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 403, response.data)
                self.assertEqual(response.data['code'], 'EMPLOYER_WORKSPACE_BLOCKED')

        posting_context = self.client.get(reverse('employer-job-posting-context'))
        self.assertEqual(posting_context.status_code, 200, posting_context.data)
        self.assertFalse(posting_context.data['job_workspace_ready'])
        self.assertEqual(posting_context.data['default_deadline_days'], 30)
        self.assertEqual(posting_context.data['max_deadline_days'], 90)
        self.assertEqual(posting_context.data['max_public_lifetime_days'], 90)

        self.client.force_authenticate(self.user)
        with patch(
            'apps.employers.models.readiness.current_dpa_status',
            return_value=DpaStatus.HOLD,
        ):
            response = self.client.get(reverse('employer-job-list-create'))
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data['code'], 'EMPLOYER_WORKSPACE_BLOCKED')

    def test_nonapproved_verification_keeps_job_workspace_reads_available(self):
        verification_case = self.recruiter.verification_case
        verification_case.status = EmployerVerificationCase.Status.CHANGES_REQUESTED
        verification_case.save(update_fields=['status', 'updated_at'])
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Workspace survives verification changes request',
        )
        self.client.force_authenticate(self.user)

        listing = self.client.get(reverse('employer-job-list-create'))
        detail = self.client.get(
            reverse('employer-job-detail', kwargs={'public_id': job.public_id})
        )

        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(detail.status_code, 200, detail.data)

    def test_employer_list_groups_candidate_previews_and_uses_latest_application(self):
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Backend Engineer',
            description='Build reliable APIs.',
            application_count=3,
        )
        first_candidate = User.objects.create_user(
            email='first-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            full_name='Nguyễn Minh Anh',
            avatar_url='users/avatars/minh-anh.png',
        )
        second_candidate = User.objects.create_user(
            email='second-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            full_name='Trần Hoàng Nam',
        )
        first_cv = UserCv.objects.create(
            user=first_candidate,
            cv_type=UserCv.CvType.BUILDER,
            title='Backend CV v1',
        )
        first_version = CvVersion.objects.create(
            cv=first_cv,
            version_number=1,
            content_hash='1' * 64,
            created_by=first_candidate,
        )
        second_cv = UserCv.objects.create(
            user=second_candidate,
            cv_type=UserCv.CvType.BUILDER,
            title='Platform CV',
        )
        second_version = CvVersion.objects.create(
            cv=second_cv,
            version_number=1,
            content_hash='2' * 64,
            created_by=second_candidate,
        )
        first_submission = Application.objects.create(
            candidate=first_candidate,
            job=job,
            cv=first_cv,
            submitted_cv_version=first_version,
            submitted_cv_title='Backend CV v1',
            status=Application.Status.VIEWED,
        )
        second_candidate_submission = Application.objects.create(
            candidate=second_candidate,
            job=job,
            cv=second_cv,
            submitted_cv_version=second_version,
            submitted_cv_title='Platform CV',
        )
        latest_submission = Application.objects.create(
            candidate=first_candidate,
            job=job,
            cv=first_cv,
            submitted_cv_version=first_version,
            submitted_cv_title='Backend CV v2',
            status=Application.Status.SHORTLISTED,
        )
        now = timezone.now()
        Application.objects.filter(pk=first_submission.pk).update(
            applied_at=now - timedelta(days=2)
        )
        Application.objects.filter(pk=second_candidate_submission.pk).update(
            applied_at=now - timedelta(days=1)
        )
        Application.objects.filter(pk=latest_submission.pk).update(applied_at=now)
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse('employer-job-list-create'))

        self.assertEqual(response.status_code, 200, response.data)
        item = response.data['results'][0]
        self.assertEqual(item['application_count'], 3)
        self.assertEqual(item['candidate_count'], 2)
        self.assertEqual(len(item['candidate_previews']), 2)
        latest_preview, second_preview = item['candidate_previews']
        self.assertEqual(
            latest_preview,
            {
                'application_public_id': latest_submission.public_id,
                'public_id': first_candidate.public_id,
                'full_name': 'Nguyễn Minh Anh',
                'avatar_url': 'http://testserver/media/users/avatars/minh-anh.png',
                'cv_title': 'Backend CV v2',
                'status': Application.Status.SHORTLISTED,
                'applied_at': now,
            },
        )
        self.assertEqual(
            second_preview['application_public_id'], second_candidate_submission.public_id
        )
        self.assertEqual(second_preview['public_id'], second_candidate.public_id)
        self.assertEqual(second_preview['avatar_url'], '')
        self.assertNotIn(
            first_submission.public_id,
            [preview['application_public_id'] for preview in item['candidate_previews']],
        )

    def payload(self):
        return {
            'title': 'Nhân viên chăm sóc khách hàng',
            'description': '<p>Tư vấn và hỗ trợ học viên.</p>',
            'requirements': '<p>Giao tiếp tốt.</p>',
            'benefits': '<p>Đầy đủ chế độ.</p>',
            'work_type': Job.WorkType.ONSITE,
            'work_types': [Job.WorkType.ONSITE, Job.WorkType.HYBRID],
            'employment_type': Job.EmploymentType.WORK_FROM_HOME,
            'experience_years': Job.ExperienceYears.UNDER_1,
            'position_level': Job.PositionLevel.EMPLOYEE,
            'education_level': Job.EducationLevel.UNIVERSITY,
            'gender_requirement': Job.GenderRequirement.FEMALE,
            'age_min': 22,
            'age_max': 30,
            'number_of_vacancies': 6,
            'salary_type': Job.SalaryType.RANGE,
            'salary_min': '9000000',
            'salary_max': '12000000',
            'income_display_type': Job.IncomeDisplayType.INCOME_AT_KPI,
            'currency': 'VND',
            'category_assignments': [
                {'category': self.specialization.pk, 'role': 'primary_specialization'},
                {'category': self.domain.pk, 'role': 'domain_knowledge'},
            ],
            'job_locations': [
                {'location': self.ward.pk, 'address_detail': '55 Cầu Giấy'},
            ],
            'work_schedules': [
                {
                    'weekday_from': 1,
                    'weekday_to': 5,
                    'start_time': '08:00',
                    'end_time': '17:00',
                },
            ],
            'job_skills': [
                {'skill': self.skill.pk, 'importance': 'required'},
            ],
            'job_benefits': [
                {'benefit': self.benefit.pk},
            ],
            'language_requirements': [
                {
                    'language': self.language.pk,
                    'proficiency_level': 'conversational',
                    'certificate': 'TOPIK 1',
                },
            ],
            'application_contact': {
                'recipient_name': 'Nguyễn Văn A',
                'phone': '0900000000',
                'emails': [{'email': 'hr@acme.test'}],
            },
        }

    def test_nested_create_persists_complete_job_posting(self):
        serializer = EmployerJobWriteSerializer(data=self.payload())

        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        self.assertEqual(job.employment_type, Job.EmploymentType.WORK_FROM_HOME)
        self.assertEqual(job.work_types, [Job.WorkType.ONSITE, Job.WorkType.HYBRID])
        self.assertEqual(job.work_type, Job.WorkType.ONSITE)
        self.assertEqual(
            job.income_display_type,
            Job.IncomeDisplayType.INCOME_AT_KPI,
        )
        self.assertEqual(job.category_assignments.count(), 2)
        self.assertEqual(job.job_locations.count(), 1)
        self.assertEqual(job.work_schedules.count(), 1)
        self.assertEqual(job.job_skills.count(), 1)
        self.assertEqual(job.job_benefits.count(), 1)
        self.assertEqual(job.language_requirements.count(), 1)
        self.assertEqual(job.application_contact.emails.count(), 1)

    def test_create_and_edit_contract_persists_automatic_application_status_settings(self):
        payload = self.payload()
        payload.update(
            auto_reject_stale_applications=True,
            auto_reject_after_days=28,
            auto_rejection_email_body='Cảm ơn bạn đã ứng tuyển {job_title}.',
        )
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)
        detail = EmployerJobWriteSerializer(job).data

        self.assertTrue(detail['auto_reject_stale_applications'])
        self.assertEqual(detail['auto_reject_after_days'], 28)
        self.assertEqual(
            detail['auto_rejection_email_body'],
            'Cảm ơn bạn đã ứng tuyển {job_title}.',
        )

    def test_enabled_automatic_status_requires_candidate_email_content(self):
        payload = self.payload()
        payload.update(
            auto_reject_stale_applications=True,
            auto_rejection_email_body='   ',
        )
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn('auto_rejection_email_body', serializer.errors)

    def test_draft_accepts_incomplete_salary_and_partial_contact(self):
        serializer = EmployerJobDraftSerializer(
            data={
                'title': '',
                'description': '',
                'salary_type': Job.SalaryType.RANGE,
                'salary_min': None,
                'salary_max': None,
                'income_display_type': Job.IncomeDisplayType.INCOME_AT_KPI,
                'application_contact': {
                    'recipient_name': 'Nguyễn Văn A',
                    'phone': '',
                    'emails': [],
                },
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        self.assertIsNone(job.salary_type)
        self.assertEqual(job.income_display_type, Job.IncomeDisplayType.INCOME_AT_KPI)
        self.assertEqual(job.application_contact.recipient_name, 'Nguyễn Văn A')
        self.assertEqual(job.application_contact.phone, '')
        self.assertEqual(job.application_contact.emails.count(), 0)

    def test_campaign_accepts_multiple_jobs(self):
        recruiter = self.recruiter
        campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=self.company,
            name='Tuyển chăm sóc khách hàng',
        )
        self.client.force_authenticate(self.user)
        url = f'{reverse("employer-job-list-create")}?as=draft'
        first_payload = self.payload()
        first_payload['campaign'] = campaign.public_id

        first = self.client.post(url, first_payload, format='json')
        second_payload = self.payload()
        second_payload.update(
            {'campaign': campaign.public_id, 'title': 'Nhân viên chăm sóc khách hàng ca tối'}
        )
        second = self.client.post(url, second_payload, format='json')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(Job.objects.filter(campaign=campaign).count(), 2)

    def test_campaign_assignment_requires_ownership_and_an_open_campaign(self):
        other_recruiter = self.recruiter
        foreign_owner = User.objects.create_user(
            email='foreign-campaign@example.com', password='Password@123', role=User.Role.EMPLOYER
        )
        foreign_company = Company.objects.create(
            company_name='Foreign Co', created_by=foreign_owner
        )
        foreign_campaign = RecruitmentCampaign.objects.create(
            owner=RecruiterProfile.objects.create(user=foreign_owner, company=foreign_company),
            company=foreign_company,
            name='Chiến dịch người khác',
        )
        completed_campaign = RecruitmentCampaign.objects.create(
            owner=other_recruiter,
            company=self.company,
            name='Chiến dịch đã hoàn tất',
            status=RecruitmentCampaign.Status.COMPLETED,
        )
        self.client.force_authenticate(self.user)
        url = f'{reverse("employer-job-list-create")}?as=draft'

        foreign = self.client.post(
            url, {**self.payload(), 'campaign': foreign_campaign.public_id}, format='json'
        )
        completed_payload = self.payload()
        completed_payload['title'] = 'Tin khác'
        completed_payload['campaign'] = completed_campaign.public_id
        completed = self.client.post(url, completed_payload, format='json')

        self.assertEqual(foreign.status_code, 400)
        self.assertEqual(foreign.data['campaign'][0], 'Chiến dịch không thuộc tài khoản này.')
        self.assertEqual(completed.status_code, 400)
        self.assertEqual(
            completed.data['campaign'][0],
            'Không thể thêm tin tuyển dụng vào chiến dịch đã hủy hoặc hoàn tất.',
        )

    def test_job_can_move_between_campaigns_or_be_detached(self):
        recruiter = self.recruiter
        first_campaign = RecruitmentCampaign.objects.create(
            owner=recruiter, company=self.company, name='Chiến dịch A'
        )
        second_campaign = RecruitmentCampaign.objects.create(
            owner=recruiter, company=self.company, name='Chiến dịch B'
        )
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            campaign=first_campaign,
            title='Tin nháp',
            description='Mô tả công việc.',
        )
        self.client.force_authenticate(self.user)
        url = reverse('employer-job-detail', kwargs={'public_id': job.public_id})

        moved = self.client.patch(url, {'campaign': second_campaign.public_id}, format='json')
        detached = self.client.patch(url, {'campaign': None}, format='json')

        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertEqual(detached.status_code, 200, detached.data)
        job.refresh_from_db()
        self.assertIsNone(job.campaign)

    def test_range_salary_with_one_bound_is_normalized_and_saved(self):
        cases = (
            (Job.IncomeDisplayType.INCOME, 9000000, None, Job.SalaryType.FROM),
            (Job.IncomeDisplayType.INCOME, None, 12000000, Job.SalaryType.UP_TO),
            (Job.IncomeDisplayType.INCOME_AT_KPI, 9000000, None, Job.SalaryType.FROM),
            (Job.IncomeDisplayType.INCOME_AT_KPI, None, 12000000, Job.SalaryType.UP_TO),
        )
        for income_display_type, salary_min, salary_max, expected_type in cases:
            with self.subTest(
                income_display_type=income_display_type,
                salary_min=salary_min,
                salary_max=salary_max,
            ):
                payload = self.payload()
                payload['salary_min'] = salary_min
                payload['salary_max'] = salary_max
                payload['income_display_type'] = income_display_type
                serializer = EmployerJobWriteSerializer(data=payload)

                self.assertTrue(serializer.is_valid(), serializer.errors)
                job = serializer.save(posted_by=self.user, company=self.company)
                self.assertEqual(job.salary_type, expected_type)
                self.assertEqual(job.salary_min, salary_min)
                self.assertEqual(job.salary_max, salary_max)
                self.assertEqual(job.income_display_type, income_display_type)

    def test_new_job_location_accepts_province_for_all_wards(self):
        payload = self.payload()
        payload['job_locations'][0]['location'] = self.province.pk
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_new_job_location_accepts_empty_address_detail(self):
        payload = self.payload()
        payload['job_locations'][0]['address_detail'] = ''
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_new_job_schedule_accepts_empty_end_time(self):
        payload = self.payload()
        payload['work_schedules'][0]['end_time'] = None
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_new_job_location_accepts_same_ward_with_different_addresses(self):
        payload = self.payload()
        payload['job_locations'].append(
            {
                'location': self.ward.pk,
                'address_detail': 'Một địa chỉ khác',
                'sort_order': 1,
            }
        )
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_contact_rejects_more_than_five_emails(self):
        payload = self.payload()
        payload['application_contact']['emails'] = [
            {'email': f'hr{index}@acme.test'} for index in range(6)
        ]
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn('application_contact', serializer.errors)

    def test_public_detail_does_not_expose_application_contact(self):
        serializer = EmployerJobWriteSerializer(data=self.payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        data = JobDetailSerializer(job).data

        self.assertNotIn('application_contact', data)
        self.assertNotIn('hr@acme.test', str(data))
        self.assertTrue(
            {
                'status',
                'application_count',
                'tier',
                'has_flash_badge',
                'category_assignments',
                'job_skills',
                'job_benefits',
                'updated_at',
            }.isdisjoint(data)
        )

    def test_public_detail_exposes_grouped_view_model(self):
        payload = self.payload()
        ward2 = Location.objects.create(
            code='00002-test',
            level=Location.Level.WARD,
            name='Phường Dịch Vọng',
            parent=self.province,
        )
        province2 = Location.objects.create(
            code='02-test',
            level=Location.Level.PROVINCE,
            name='Thành phố Đà Nẵng',
        )
        ward3 = Location.objects.create(
            code='00003-test',
            level=Location.Level.WARD,
            name='Phường Hải Châu',
            parent=province2,
        )
        preferred_skill = Skill.objects.create(name='Excel', group=self.skill_group)
        # Đặt category tường minh để khẳng định thứ tự nhóm, không phụ thuộc dữ liệu seed sẵn có.
        Benefit.objects.filter(pk=self.benefit.pk).update(category=Benefit.Category.OTHER)
        welfare_benefit, _ = Benefit.objects.update_or_create(
            name='Thưởng tháng 13', defaults={'category': Benefit.Category.WELFARE}
        )
        allowance_benefit, _ = Benefit.objects.update_or_create(
            name='Phụ cấp ăn trưa', defaults={'category': Benefit.Category.ALLOWANCE}
        )
        payload['job_skills'].append({'skill': preferred_skill.pk, 'importance': 'preferred'})
        # Thêm ngược thứ tự danh mục để chắc chắn nhóm được sắp theo Benefit.Category.
        payload['job_benefits'] += [
            {'benefit': welfare_benefit.pk},
            {'benefit': allowance_benefit.pk},
        ]
        payload['job_locations'] += [
            {'location': ward2.pk, 'address_detail': '12 Dịch Vọng'},
            {'location': ward3.pk, 'address_detail': '3 Hải Châu'},
        ]
        serializer = EmployerJobWriteSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        data = JobDetailSerializer(job).data

        self.assertEqual(
            data['primary_specialization'],
            {
                'id': self.specialization.pk,
                'name': 'Chăm sóc khách hàng',
                'slug': self.specialization.slug,
            },
        )
        self.assertEqual(
            [item['name'] for item in data['domain_knowledge']],
            ['Giáo dục / Đào tạo'],
        )

        self.assertEqual(len(data['workplace_groups']), 2)
        hanoi = next(
            g for g in data['workplace_groups'] if g['province_name'] == 'Thành phố Hà Nội'
        )
        self.assertEqual(
            [address['display'] for address in hanoi['addresses']],
            ['55 Cầu Giấy, Phường Cầu Giấy', '12 Dịch Vọng, Phường Dịch Vọng'],
        )
        danang = next(
            g for g in data['workplace_groups'] if g['province_name'] == 'Thành phố Đà Nẵng'
        )
        self.assertEqual(danang['addresses'][0]['display'], '3 Hải Châu, Phường Hải Châu')

        # Kỹ năng đã tách khỏi hàng tag tóm tắt, chỉ còn ở required_skills/preferred_skills.
        self.assertEqual(
            data['requirement_tags'],
            [
                'Dưới 1 năm kinh nghiệm',
                'Tuổi 22 - 30',
                'Từ Đại học trở lên',
                'Giới tính: Nữ',
            ],
        )
        self.assertEqual(data['required_skills'], ['Giao tiếp'])
        self.assertEqual(data['preferred_skills'], ['Excel'])
        self.assertEqual(
            data['benefit_groups'],
            [
                {
                    'category': 'allowance',
                    'category_label': 'Phụ cấp',
                    'items': ['Phụ cấp ăn trưa'],
                },
                {
                    'category': 'welfare',
                    'category_label': 'Phúc lợi',
                    'items': ['Thưởng tháng 13'],
                },
                {'category': 'other', 'category_label': 'Khác', 'items': ['Bảo hiểm xã hội']},
            ],
        )

        language = data['language_requirements'][0]
        self.assertEqual(language['language_name'], 'Tiếng Hàn')
        self.assertEqual(language['proficiency_label'], 'Giao tiếp')
        self.assertEqual(language['certificate'], 'TOPIK 1')

    def test_public_detail_view_model_handles_minimal_job(self):
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Tuyển gấp nhân viên',
            description='Mô tả',
            status=Job.Status.ACTIVE,
        )

        data = JobDetailSerializer(job).data

        self.assertIsNone(data['primary_specialization'])
        self.assertEqual(data['domain_knowledge'], [])
        self.assertEqual(data['workplace_groups'], [])
        self.assertEqual(data['requirement_tags'], [])
        self.assertEqual(data['benefit_tags'], [])
        self.assertEqual(data['required_skills'], [])
        self.assertEqual(data['preferred_skills'], [])
        self.assertEqual(data['benefit_groups'], [])
