"""Hợp đồng số query cho endpoint list chịu tải cao nhất (AR-P4).

Nguyên tắc: số query KHÔNG phụ thuộc số bản ghi (chống N+1). Test tạo N=5 job
và khóa tổng query của response list bằng assertNumQueries. Khi thêm
field/relation mới làm tăng số query, cập nhật con số kèm giải thích trong PR —
tăng không giải thích = regression.
"""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.skills.models import Skill

from ..models import Job, JobCategory, JobCategoryAssignment, JobSkill, SavedJob

# 1 COUNT (pagination) + 1 SELECT jobs + 3 prefetch (categories, locations,
# skills). select_related company nằm trong SELECT chính.
#
# +4 cho huy hiệu xác thực nhà tuyển dụng (`company_verified`): 1 đọc ngưỡng
# tuổi tài khoản từ site settings, 3 gom điều kiện của mọi công ty trong trang
# (hồ sơ NTD, giấy phép kinh doanh đã duyệt, báo cáo tin bị xác nhận vi phạm).
# Bốn query này chạy một lần cho cả response nên tổng vẫn phẳng theo số bản ghi.
BADGE_QUERY_BUDGET = 4
JOB_LIST_QUERY_BUDGET = 5 + BADGE_QUERY_BUDGET
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
