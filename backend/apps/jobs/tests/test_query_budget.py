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

from ..models import Job

# 1 COUNT (pagination) + 1 SELECT jobs + 3 prefetch (categories, locations,
# skills). select_related company nằm trong SELECT chính.
JOB_LIST_QUERY_BUDGET = 5


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
