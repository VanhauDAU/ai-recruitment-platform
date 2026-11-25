"""Hợp đồng số query cho endpoint list chịu tải cao nhất (AR-P4).

Nguyên tắc: số query KHÔNG phụ thuộc số bản ghi (chống N+1). Test tạo N=5 job
và khóa tổng query của response list bằng assertNumQueries. Khi thêm
field/relation mới làm tăng số query, cập nhật con số kèm giải thích trong PR —
tăng không giải thích = regression.
"""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.applications.models import Application
from apps.cvs.models import CvVersion, UserCv
from apps.employers.models import Company, CompanyPinnedJob
from apps.employers.tests.factories import make_employer_ready
from apps.locations.models import Location
from apps.skills.models import Skill

from ..models import Job, JobCategory, JobCategoryAssignment, JobLocation, JobSkill, SavedJob
from .factories import open_visibility_window

# +1 cho mỗi request vào API cổng ứng viên/NTD/công khai: middleware bảo trì đọc
# `maintenance_mode` (ADR-0026). Trong TestCase mọi request nằm trong transaction nên
# selector đọc thẳng DB; ở production đọc từ cache.
MAINTENANCE_CHECK_QUERIES = 1
# 1 COUNT (pagination) + 1 SELECT jobs + 3 prefetch (categories, locations,
# skills). select_related company nằm trong SELECT chính.
#
# +3 cho huy hiệu tin cậy nhà tuyển dụng (`company_verified`): setting tuổi,
# recruiter + correlated legal/report evidence, và active domain claims. Các
# query chạy một lần cho cả response nên tổng vẫn phẳng theo số bản ghi.
BADGE_QUERY_BUDGET = 3
# +1 cho ngưỡng nhãn "Sắp hết hạn" (`job_closing_soon_days`, ADR-0030): đọc một lần
# cho cả trang; giống MAINTENANCE_CHECK_QUERIES, production đọc từ cache.
LABEL_SETTING_QUERIES = 1
CARD_QUERIES = BADGE_QUERY_BUDGET + LABEL_SETTING_QUERIES + MAINTENANCE_CHECK_QUERIES
JOB_LIST_QUERY_BUDGET = 5 + CARD_QUERIES
# Homepage preview adds two relation prefetches (benefits + schedules).
HOMEPAGE_BEST_JOB_LIST_QUERY_BUDGET = JOB_LIST_QUERY_BUDGET + 2
# Chip địa điểm: đếm theo tỉnh + đếm theo phường + 1 SELECT tên (kèm tỉnh cha).
HOMEPAGE_BEST_JOB_LOCATIONS_QUERY_BUDGET = 3 + MAINTENANCE_CHECK_QUERIES
# Dashboard thống kê trang chủ: tài khoản, tổng/tăng trưởng/lương (một aggregate),
# danh mục gộp theo gốc, việc mới nhất + prefetch địa điểm.
JOB_STATS_QUERY_BUDGET = 5 + MAINTENANCE_CHECK_QUERIES
ADMIN_JOB_LIST_QUERY_BUDGET = 2
# +1 aggregate for the status-tab counts and +1 category prefetch (one query
# each whatever the page size).
EMPLOYER_JOB_LIST_QUERY_BUDGET = 7 + MAINTENANCE_CHECK_QUERIES
SAVED_JOB_SIMILARITY_QUERY_BUDGET = 8 + CARD_QUERIES
SAVED_JOB_FALLBACK_QUERY_BUDGET = 9 + CARD_QUERIES


class JobListQueryBudgetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)
        make_employer_ready(
            self.user,
            company=self.company,
            candidate_data=True,
        )
        for index in range(5):
            Job.objects.create(
                posted_by=self.user,
                company=self.company,
                title=f'Job {index}',
                description='Description',
                salary_min=10_000_000,
                salary_max=20_000_000,
                salary_type=Job.SalaryType.RANGE,
                status=Job.Status.ACTIVE,
                **open_visibility_window(),
            )

    def test_job_list_query_count_is_flat_regardless_of_row_count(self):
        with self.assertNumQueries(JOB_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('job-list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)

    def test_company_filter_adds_no_query_to_the_job_list(self):
        with self.assertNumQueries(JOB_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('job-list'), {'company': self.company.public_id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)

    def test_pinned_jobs_lead_the_company_job_list_without_an_extra_query(self):
        oldest, newest = Job.objects.order_by('id')[0], Job.objects.order_by('id')[4]
        for position, job in enumerate((oldest, newest)):
            CompanyPinnedJob.objects.create(company=self.company, job=job, sort_order=position)

        with self.assertNumQueries(JOB_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('job-list'), {'company': self.company.public_id})

        self.assertEqual(
            [job['public_id'] for job in response.data['results']][:2],
            [oldest.public_id, newest.public_id],
        )
        self.assertEqual(len(response.data['results']), 5)

    def test_homepage_best_jobs_query_count_is_flat(self):
        with self.assertNumQueries(HOMEPAGE_BEST_JOB_LIST_QUERY_BUDGET):
            response = self.client.get(
                reverse('homepage-best-job-list'),
                {'page_size': 12, 'rotation_seed': 'query-budget'},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)

    def test_homepage_best_job_locations_query_count_is_flat(self):
        province = Location.objects.create(code='qb-p', level=Location.Level.PROVINCE, name='P')
        for index, job in enumerate(Job.objects.all()):
            ward = Location.objects.create(
                code=f'qb-w{index}', level=Location.Level.WARD, name=f'W{index}', parent=province
            )
            JobLocation.objects.create(job=job, location=ward)

        with self.assertNumQueries(HOMEPAGE_BEST_JOB_LOCATIONS_QUERY_BUDGET):
            response = self.client.get(reverse('homepage-best-job-locations'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['provinces'][0]['job_count'], 5)
        self.assertEqual(len(response.data['wards']), 5)

    def test_job_stats_query_count_is_flat_and_cached(self):
        root = JobCategory.objects.create(name='Công nghệ', slug='qb-root')
        child = JobCategory.objects.create(name='Phần mềm', slug='qb-child', parent=root)
        leaf = JobCategory.objects.create(name='Backend', slug='qb-leaf', parent=child)
        province = Location.objects.create(code='qb-sp', level=Location.Level.PROVINCE, name='P')
        for index, job in enumerate(Job.objects.all()):
            category = (root, child, leaf)[index % 3]
            JobCategoryAssignment.objects.create(job=job, category=category)
            ward = Location.objects.create(
                code=f'qb-sw{index}', level=Location.Level.WARD, name=f'W{index}', parent=province
            )
            JobLocation.objects.create(job=job, location=ward)

        with self.assertNumQueries(JOB_STATS_QUERY_BUDGET):
            response = self.client.get(reverse('job-stats'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'public, max-age=60')
        self.assertEqual(response.data['active_jobs'], 5)
        self.assertEqual([item['count'] for item in response.data['demand']], [5])
        self.assertEqual(len(response.data['latest_jobs']), 5)
        self.assertEqual(response.data['latest_jobs'][0]['location_names'], ['P'])
        # Lần sau đọc payload từ cache: chỉ còn query của middleware bảo trì.
        with self.assertNumQueries(MAINTENANCE_CHECK_QUERIES):
            self.assertEqual(self.client.get(reverse('job-stats')).data, response.data)


class EmployerJobListQueryBudgetTests(APITestCase):
    def setUp(self):
        self.employer = User.objects.create_user(
            email='employer-list-budget@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Employer List Budget Co',
            created_by=self.employer,
        )
        make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        candidate = User.objects.create_user(
            email='employer-list-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            full_name='Ứng viên ngân sách',
            avatar_url='users/avatars/query-budget.png',
        )
        cv = UserCv.objects.create(
            user=candidate,
            cv_type=UserCv.CvType.BUILDER,
            title='Query budget CV',
        )
        version = CvVersion.objects.create(
            cv=cv,
            version_number=1,
            content_hash='3' * 64,
            created_by=candidate,
        )
        for index in range(5):
            job = Job.objects.create(
                posted_by=self.employer,
                company=self.company,
                title=f'Employer Job {index}',
                description='Description',
                status=Job.Status.ACTIVE,
                application_count=2,
                **open_visibility_window(),
            )
            for submission in range(2):
                Application.objects.create(
                    candidate=candidate,
                    job=job,
                    cv=cv,
                    submitted_cv_version=version,
                    submitted_cv_title=f'Query budget CV {submission}',
                    is_current=submission == 1,
                )
        self.client.force_authenticate(self.employer)

    def test_employer_job_list_query_count_is_flat_with_candidate_previews(self):
        # 1 canonical readiness query + 1 COUNT + 1 SELECT jobs
        # (candidate_count and unviewed_application_count are correlated
        # subqueries) + 1 locations prefetch + 1 category prefetch + 1 batched
        # candidate-preview query + 1 status-tab aggregate.
        with self.assertNumQueries(EMPLOYER_JOB_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('employer-job-list-create'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['results']), 5)
        self.assertTrue(
            all(len(job['candidate_previews']) == 1 for job in response.data['results'])
        )


class AdminJobListQueryBudgetTests(APITestCase):
    def setUp(self):
        self.employer = User.objects.create_user(
            email='admin-budget-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.admin = User.objects.create_user(
            email='admin-budget@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        company = Company.objects.create(
            company_name='Admin Budget Co',
            created_by=self.employer,
        )
        for index in range(5):
            Job.objects.create(
                posted_by=self.employer,
                company=company,
                title=f'Draft admin job {index}',
                description='Description',
                status=Job.Status.DRAFT,
            )
        self.client.force_authenticate(self.admin)

    def test_admin_job_list_query_count_is_flat(self):
        with self.assertNumQueries(ADMIN_JOB_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('admin-job-moderation-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)


class SavedJobRecommendationQueryBudgetTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(
            email='saved-budget-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        self.employer = User.objects.create_user(
            email='saved-budget-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Saved Budget Co',
            created_by=self.employer,
        )
        make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        self.category = JobCategory.objects.create(
            name='Budget Backend',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.source = self._job('Nguồn alpha')
        JobCategoryAssignment.objects.create(
            job=self.source,
            category=self.category,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        SavedJob.objects.create(candidate=self.candidate, job=self.source)
        self.matches = []
        for index in range(5):
            job = self._job(f'Ứng viên beta {index}')
            JobCategoryAssignment.objects.create(
                job=job,
                category=self.category,
                role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
            )
            self.matches.append(job)
        self.client.force_authenticate(self.candidate)

    def _job(self, title):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Description',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

    def test_saved_similarity_query_count_is_flat(self):
        with self.assertNumQueries(SAVED_JOB_SIMILARITY_QUERY_BUDGET):
            response = self.client.get(reverse('saved-job-recommendations'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['strategy'], 'saved-job-similarity-v1')
        self.assertEqual(len(response.data['results']), len(self.matches))

    def test_saved_fallback_query_count_is_flat(self):
        JobCategoryAssignment.objects.all().delete()
        skill = Skill.objects.create(name='Budget-only skill')
        JobSkill.objects.create(job=self.source, skill=skill)
        for job in self.matches:
            JobSkill.objects.create(job=job, skill=skill)

        with self.assertNumQueries(SAVED_JOB_FALLBACK_QUERY_BUDGET):
            response = self.client.get(reverse('saved-job-recommendations'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['strategy'], 'recent-active-fallback-v1')
        self.assertTrue(response.data['results'])
