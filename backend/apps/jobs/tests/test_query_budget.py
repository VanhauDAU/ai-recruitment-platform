"""Hợp đồng số query cho endpoint list chịu tải cao nhất (AR-P4).

Nguyên tắc: số query KHÔNG phụ thuộc số bản ghi (chống N+1). Test tạo N=5 job
và khóa tổng query của response list bằng assertNumQueries. Khi thêm
field/relation mới làm tăng số query, cập nhật con số kèm giải thích trong PR —
tăng không giải thích = regression.
"""

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.applications.models import Application
from apps.cvs.models import CvVersion, UserCv
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.skills.models import Skill

from ..models import Job, JobCategory, JobCategoryAssignment, JobSkill, SavedJob

# 1 COUNT (pagination) + 1 SELECT jobs + 3 prefetch (categories, locations,
# skills). select_related company nằm trong SELECT chính.
#
# +1 cho huy hiệu xác thực nhà tuyển dụng (`company_verified`): gom các
# EmployerVerificationCase đã approved theo đúng cặp (công ty, người đăng).
# Query này chạy một lần cho cả response nên tổng vẫn phẳng theo số bản ghi.
BADGE_QUERY_BUDGET = 1
JOB_LIST_QUERY_BUDGET = 5 + BADGE_QUERY_BUDGET
ADMIN_JOB_LIST_QUERY_BUDGET = 2
EMPLOYER_JOB_LIST_QUERY_BUDGET = 5
SAVED_JOB_SIMILARITY_QUERY_BUDGET = 8 + BADGE_QUERY_BUDGET
SAVED_JOB_FALLBACK_QUERY_BUDGET = 9 + BADGE_QUERY_BUDGET


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
            )

    def test_job_list_query_count_is_flat_regardless_of_row_count(self):
        with self.assertNumQueries(JOB_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('job-list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)


@override_settings(REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS=False)
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
            )
            for submission in range(2):
                Application.objects.create(
                    candidate=candidate,
                    job=job,
                    cv=cv,
                    submitted_cv_version=version,
                    submitted_cv_title=f'Query budget CV {submission}',
                )
        self.client.force_authenticate(self.employer)

    def test_employer_job_list_query_count_is_flat_with_candidate_previews(self):
        # 1 canonical readiness query + 1 COUNT + 1 SELECT jobs
        # (candidate_count is a correlated subquery) + 1 locations prefetch
        # + 1 batched candidate-preview query.
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
                title=f'Pending admin job {index}',
                description='Description',
                status=Job.Status.PENDING,
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
