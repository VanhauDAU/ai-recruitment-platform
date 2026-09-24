from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.applications.models import Application
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company, RecruitmentCampaign
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.locations.models import Location
from apps.skills.models import Skill

from ..models import (
    Job,
    JobCategory,
    JobCategoryAssignment,
    JobLocation,
    JobSkill,
    SavedJob,
)


class SavedJobRecommendationApiTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(
            email='saved-recommendations@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        self.employer = User.objects.create_user(
            email='saved-recommendations-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Saved Recommendations Co',
            created_by=self.employer,
        )
        self.recruiter = make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        self.category = JobCategory.objects.create(
            name='Backend Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.python = Skill.objects.create(name='Python')
        self.django = Skill.objects.create(name='Django')
        self.province = Location.objects.create(
            code='saved-rec-province',
            level=Location.Level.PROVINCE,
            name='Hà Nội',
        )
        self.ward = Location.objects.create(
            code='saved-rec-ward',
            level=Location.Level.WARD,
            name='Phường Cầu Giấy',
            parent=self.province,
        )
        self.source = self._create_job(
            'Backend Engineer',
            experience_years=Job.ExperienceYears.THREE,
            work_type=Job.WorkType.HYBRID,
            work_types=[Job.WorkType.HYBRID],
            employment_type=Job.EmploymentType.FULL_TIME,
        )
        self._add_signals(
            self.source,
            category=self.category,
            skills=[self.python, self.django],
            location=self.ward,
        )
        SavedJob.objects.create(candidate=self.candidate, job=self.source)
        self.client.force_authenticate(self.candidate)

    def _create_job(self, title, **overrides):
        values = {
            'posted_by': self.employer,
            'company': self.company,
            'title': title,
            'description': 'Mô tả công việc.',
            'status': Job.Status.ACTIVE,
        }
        values.update(overrides)
        return Job.objects.create(**values)

    def _add_signals(self, job, *, category=None, skills=(), location=None):
        if category:
            JobCategoryAssignment.objects.create(
                job=job,
                category=category,
                role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
            )
        for skill in skills:
            JobSkill.objects.create(job=job, skill=skill)
        if location:
            JobLocation.objects.create(job=job, location=location)
        return job

    def _get(self, params=None):
        return self.client.get(reverse('saved-job-recommendations'), params or {})

    def test_returns_ranked_explainable_similarity_without_mixing_fallback(self):
        exact = self._create_job(
            'Senior Backend Platform',
            experience_years=Job.ExperienceYears.THREE,
            work_type=Job.WorkType.HYBRID,
            work_types=[Job.WorkType.HYBRID],
            employment_type=Job.EmploymentType.FULL_TIME,
        )
        self._add_signals(
            exact,
            category=self.category,
            skills=[self.python, self.django],
            location=self.ward,
        )
        primary_only = self._add_signals(
            self._create_job('Vai trò sản phẩm'),
            category=self.category,
        )
        one_skill_only = self._add_signals(
            self._create_job('Phân tích dữ liệu'),
            skills=[self.python],
        )
        unrelated = self._create_job('Chuyên viên pháp lý')

        response = self._get()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['strategy'], 'saved-job-similarity-v1')
        self.assertEqual(response.data['source_saved_job_count'], 1)
        result_ids = [item['public_id'] for item in response.data['results']]
        self.assertEqual(result_ids[:2], [exact.public_id, primary_only.public_id])
        self.assertNotIn(one_skill_only.public_id, result_ids)
        self.assertNotIn(unrelated.public_id, result_ids)
        self.assertNotIn(self.source.public_id, result_ids)

        first = response.data['results'][0]
        self.assertGreater(
            first['similarity_score'], response.data['results'][1]['similarity_score']
        )
        self.assertEqual(
            first['similarity_score'],
            min(sum(item['points'] for item in first['similarity_details']), 100),
        )
        self.assertEqual(
            first['similarity_reasons'],
            [item['label'] for item in first['similarity_details']],
        )
        self.assertTrue(
            {
                'public_id',
                'slug',
                'title',
                'company_name',
                'similarity_score',
                'similarity_reasons',
                'similarity_details',
            }.issubset(first)
        )

    def test_pairwise_best_source_does_not_accumulate_duplicate_signals(self):
        target = self._add_signals(
            self._create_job('Vai trò mục tiêu'),
            category=self.category,
        )
        first_response = self._get()
        first = next(
            item for item in first_response.data['results'] if item['public_id'] == target.public_id
        )
        second_source = self._add_signals(
            self._create_job('Nguồn tuyển dụng thứ hai'),
            category=self.category,
        )
        SavedJob.objects.create(candidate=self.candidate, job=second_source)

        second_response = self._get()
        second = next(
            item
            for item in second_response.data['results']
            if item['public_id'] == target.public_id
        )

        self.assertEqual(second_response.data['source_saved_job_count'], 2)
        self.assertEqual(second['similarity_score'], first['similarity_score'])
        self.assertEqual(second['similarity_details'], first['similarity_details'])

    def test_weak_domain_or_shared_skills_plus_operational_signals_cannot_qualify(self):
        human_resources_domain = JobCategory.objects.create(
            name='Nhân sự',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        human_resources_role = JobCategory.objects.create(
            name='Chuyên viên nhân sự',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        JobCategoryAssignment.objects.create(
            job=self.source,
            category=human_resources_domain,
            role=JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE,
        )
        weak_only = self._create_job(
            'Chuyên viên nhân sự',
            experience_years=Job.ExperienceYears.THREE,
            work_type=Job.WorkType.HYBRID,
            work_types=[Job.WorkType.HYBRID],
            employment_type=Job.EmploymentType.FULL_TIME,
        )
        self._add_signals(
            weak_only,
            category=human_resources_role,
            location=self.ward,
        )
        JobCategoryAssignment.objects.create(
            job=weak_only,
            category=human_resources_domain,
            role=JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE,
        )
        single_skill_only = self._create_job(
            'Chuyên viên kiểm soát',
            experience_years=Job.ExperienceYears.THREE,
            work_type=Job.WorkType.HYBRID,
            work_types=[Job.WorkType.HYBRID],
            employment_type=Job.EmploymentType.FULL_TIME,
        )
        self._add_signals(
            single_skill_only,
            skills=[self.python],
            location=self.ward,
        )
        noisy_skills = self._create_job(
            'Kế toán thuế',
            experience_years=Job.ExperienceYears.THREE,
            work_type=Job.WorkType.HYBRID,
            work_types=[Job.WorkType.HYBRID],
            employment_type=Job.EmploymentType.FULL_TIME,
        )
        self._add_signals(
            noisy_skills,
            skills=[self.python, self.django],
            location=self.ward,
        )
        strong = self._add_signals(
            self._create_job('Vai trò nền tảng'),
            category=self.category,
        )

        response = self._get()

        self.assertEqual(response.data['strategy'], 'saved-job-similarity-v1')
        result_ids = [item['public_id'] for item in response.data['results']]
        self.assertIn(strong.public_id, result_ids)
        self.assertNotIn(weak_only.public_id, result_ids)
        self.assertNotIn(single_skill_only.public_id, result_ids)
        self.assertNotIn(noisy_skills.public_id, result_ids)

    def test_generic_vietnamese_title_tokens_cannot_anchor_an_unrelated_job(self):
        generic_source = self._create_job('Trưởng phòng Marketing')
        SavedJob.objects.create(candidate=self.candidate, job=generic_source)
        unrelated = self._create_job('Trưởng phòng Nhân sự')
        strong = self._add_signals(
            self._create_job('Vai trò nền tảng'),
            category=self.category,
        )

        response = self._get()

        result_ids = [item['public_id'] for item in response.data['results']]
        self.assertIn(strong.public_id, result_ids)
        self.assertNotIn(unrelated.public_id, result_ids)

    def test_title_tokens_cannot_override_conflicting_primary_categories(self):
        technology = JobCategory.objects.create(
            name='Công nghệ thông tin',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        frontend_web = JobCategory.objects.create(
            name='Frontend Web',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
            parent=technology,
        )
        frontend_apps = JobCategory.objects.create(
            name='Frontend Ứng dụng',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
            parent=technology,
        )
        accounting = JobCategory.objects.create(
            name='Kế toán bán hàng',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        warehouse = JobCategory.objects.create(
            name='Nhân viên kho',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        accounting_source = self._add_signals(
            self._create_job('Kế toán bán hàng'),
            category=accounting,
        )
        SavedJob.objects.create(candidate=self.candidate, job=accounting_source)
        related_source = self._add_signals(
            self._create_job(
                'Frontend ReactJS',
                work_type=Job.WorkType.HYBRID,
                employment_type=Job.EmploymentType.FULL_TIME,
            ),
            category=frontend_web,
        )
        SavedJob.objects.create(candidate=self.candidate, job=related_source)
        same_group = self._add_signals(
            self._create_job('Frontend VueJS'),
            category=frontend_apps,
        )
        same_group_with_support = self._add_signals(
            self._create_job(
                'Vai trò sản phẩm',
                work_type=Job.WorkType.HYBRID,
                employment_type=Job.EmploymentType.FULL_TIME,
            ),
            category=frontend_apps,
        )
        unrelated = self._add_signals(
            self._create_job('Nhân viên kho hàng'),
            category=warehouse,
        )
        strong = self._add_signals(
            self._create_job('Vai trò nền tảng'),
            category=self.category,
        )

        response = self._get()

        result_ids = [item['public_id'] for item in response.data['results']]
        self.assertIn(strong.public_id, result_ids)
        self.assertIn(same_group.public_id, result_ids)
        self.assertIn(same_group_with_support.public_id, result_ids)
        self.assertNotIn(unrelated.public_id, result_ids)

    def test_excludes_saved_applied_and_unavailable_jobs_without_cross_user_leakage(self):
        visible = self._add_signals(
            self._create_job('Backend hợp lệ'),
            category=self.category,
        )
        other_candidate = User.objects.create_user(
            email='other-saved-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        SavedJob.objects.create(candidate=other_candidate, job=visible)

        owner_saved = self._add_signals(
            self._create_job('Backend đã lưu'),
            category=self.category,
        )
        SavedJob.objects.create(candidate=self.candidate, job=owner_saved)

        applied = self._add_signals(
            self._create_job('Backend đã ứng tuyển'),
            category=self.category,
        )
        cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV Backend',
        )
        version = create_initial_document(cv, self.candidate)
        Application.objects.create(
            candidate=self.candidate,
            job=applied,
            cv=cv,
            submitted_cv_version=version,
            submitted_cv_title=cv.title,
            submitted_cv_source=cv.source,
        )

        closed = self._add_signals(
            self._create_job('Backend đã đóng', status=Job.Status.CLOSED),
            category=self.category,
        )
        expired = self._add_signals(
            self._create_job(
                'Backend hết hạn',
                deadline=timezone.localdate() - timedelta(days=1),
            ),
            category=self.category,
        )
        paused_campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Chiến dịch tạm dừng',
            status=RecruitmentCampaign.Status.PAUSED,
        )
        paused = self._add_signals(
            self._create_job('Backend chiến dịch dừng', campaign=paused_campaign),
            category=self.category,
        )

        response = self._get()

        result_ids = {item['public_id'] for item in response.data['results']}
        self.assertIn(visible.public_id, result_ids)
        for excluded in (self.source, owner_saved, applied, closed, expired, paused):
            self.assertNotIn(excluded.public_id, result_ids)

    def test_uses_recent_active_fallback_when_no_job_qualifies(self):
        low_score = self._add_signals(
            self._create_job(
                'Phân tích dữ liệu',
                published_at=timezone.now() - timedelta(hours=2),
            ),
            skills=[self.python],
        )
        newest = self._create_job(
            'Chuyên viên pháp lý',
            published_at=timezone.now() - timedelta(hours=1),
        )

        response = self._get()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['strategy'], 'recent-active-fallback-v1')
        self.assertEqual(response.data['results'][0]['public_id'], newest.public_id)
        self.assertIn(low_score.public_id, [item['public_id'] for item in response.data['results']])
        for item in response.data['results']:
            self.assertEqual(item['similarity_score'], 0)
            self.assertEqual(item['similarity_reasons'], [])
            self.assertEqual(item['similarity_details'], [])

    def test_no_saved_jobs_uses_fallback_and_empty_only_when_no_job_exists(self):
        SavedJob.objects.all().delete()
        self.source.delete()
        older = self._create_job(
            'Công việc cũ hơn',
            published_at=timezone.now() - timedelta(days=2),
        )
        newer = self._create_job(
            'Công việc mới hơn',
            published_at=timezone.now() - timedelta(days=1),
        )

        fallback_response = self._get()

        self.assertEqual(fallback_response.data['status'], 'ready')
        self.assertEqual(fallback_response.data['strategy'], 'recent-active-fallback-v1')
        self.assertEqual(fallback_response.data['source_saved_job_count'], 0)
        self.assertEqual(
            [item['public_id'] for item in fallback_response.data['results']],
            [newer.public_id, older.public_id],
        )

        Job.objects.all().delete()
        empty_response = self._get()

        self.assertEqual(empty_response.data['status'], 'empty')
        self.assertEqual(empty_response.data['strategy'], 'recent-active-fallback-v1')
        self.assertEqual(empty_response.data['results'], [])

    def test_limit_defaults_to_twelve_and_rejects_invalid_values(self):
        for index in range(13):
            self._add_signals(
                self._create_job(f'Vị trí phù hợp {index}'),
                category=self.category,
            )

        default_response = self._get()
        limited_response = self._get({'limit': 1})

        self.assertEqual(len(default_response.data['results']), 12)
        self.assertEqual(len(limited_response.data['results']), 1)
        for invalid in (0, 21, 'invalid'):
            with self.subTest(limit=invalid):
                self.assertEqual(self._get({'limit': invalid}).status_code, 400)

    def test_considers_only_twenty_sources_but_excludes_every_saved_job(self):
        for index in range(20):
            SavedJob.objects.create(
                candidate=self.candidate,
                job=self._create_job(f'Nguồn đã lưu {index}'),
            )

        response = self._get()

        saved_ids = set(
            SavedJob.objects.filter(candidate=self.candidate).values_list(
                'job__public_id',
                flat=True,
            )
        )
        self.assertEqual(response.data['source_saved_job_count'], 20)
        self.assertTrue(
            saved_ids.isdisjoint(item['public_id'] for item in response.data['results'])
        )

    def test_endpoint_is_candidate_only_and_does_not_require_preferences_or_consent(self):
        candidate_response = self._get()
        self.client.force_authenticate(self.employer)
        employer_response = self._get()
        self.client.force_authenticate(user=None)
        anonymous_response = self._get()

        self.assertEqual(candidate_response.status_code, 200)
        self.assertEqual(employer_response.status_code, 403)
        self.assertEqual(anonymous_response.status_code, 401)

    def test_saved_endpoint_accepts_active_and_rejects_unavailable_jobs(self):
        available = self._create_job('Tin đang public')
        available_response = self.client.post(
            reverse('saved-job-list-create'),
            {'job': available.public_id},
            format='json',
        )

        self.assertEqual(available_response.status_code, 201)
        self.assertTrue(
            SavedJob.objects.filter(
                candidate=self.candidate,
                job=available,
            ).exists()
        )

        for status in (Job.Status.DRAFT, Job.Status.CLOSED, Job.Status.REJECTED):
            with self.subTest(status=status):
                unavailable = self._create_job(
                    f'Tin không public {status}',
                    status=status,
                )

                response = self.client.post(
                    reverse('saved-job-list-create'),
                    {'job': unavailable.public_id},
                    format='json',
                )

                self.assertEqual(response.status_code, 400)
                self.assertFalse(
                    SavedJob.objects.filter(
                        candidate=self.candidate,
                        job=unavailable,
                    ).exists()
                )
