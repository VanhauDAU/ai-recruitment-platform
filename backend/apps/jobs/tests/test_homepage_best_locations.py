"""Location chips of the homepage Best Jobs box only list places with public jobs."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.locations.models import Location

from ..models import Job, JobLocation
from .factories import open_visibility_window


class HomepageBestJobLocationsApiTests(APITestCase):
    def setUp(self):
        self.employer = User.objects.create_user(
            email='locations@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Loc Co', created_by=self.employer)
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        self.hanoi = self.province('hn', 'Thành phố Hà Nội')
        self.hcm = self.province('hcm', 'Thành phố Hồ Chí Minh')
        self.empty = self.province('dn', 'Thành phố Đà Nẵng')
        self.ba_dinh = self.ward('bd', 'Phường Ba Đình', self.hanoi)
        self.hoan_kiem = self.ward('hk', 'Phường Hoàn Kiếm', self.hanoi)
        self.ben_thanh = self.ward('bt', 'Phường Bến Thành', self.hcm)

    def province(self, code, name):
        return Location.objects.create(code=code, level=Location.Level.PROVINCE, name=name)

    def ward(self, code, name, parent):
        return Location.objects.create(
            code=code, level=Location.Level.WARD, name=name, parent=parent
        )

    def create_job(self, *locations, **overrides):
        job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Job',
            description='Description',
            deadline=timezone.localdate() + timedelta(days=30),
            **{'status': Job.Status.ACTIVE, **open_visibility_window(), **overrides},
        )
        for order, location in enumerate(locations):
            JobLocation.objects.create(job=job, location=location, sort_order=order)
        return job

    def fetch(self):
        response = self.client.get(reverse('homepage-best-job-locations'))
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_lists_only_locations_with_public_jobs_most_jobs_first(self):
        self.create_job(self.ben_thanh)
        self.create_job(self.ba_dinh, self.hoan_kiem)  # một tin, hai phường cùng tỉnh
        self.create_job(self.hanoi)  # liên kết tỉnh cũ vẫn được tính
        self.create_job(self.ba_dinh)

        data = self.fetch()

        self.assertEqual(
            [(item['name'], item['job_count']) for item in data['provinces']],
            [('Thành phố Hà Nội', 3), ('Thành phố Hồ Chí Minh', 1)],
        )
        self.assertEqual(
            [(item['name'], item['parent_name'], item['job_count']) for item in data['wards']],
            [
                ('Phường Ba Đình', 'Thành phố Hà Nội', 2),
                ('Phường Hoàn Kiếm', 'Thành phố Hà Nội', 1),
                ('Phường Bến Thành', 'Thành phố Hồ Chí Minh', 1),
            ],
        )
        self.assertEqual(data['wards'][0]['parent_id'], self.hanoi.id)

    def test_jobs_that_are_not_public_are_not_counted(self):
        self.create_job(self.ben_thanh, status=Job.Status.CLOSED)
        self.create_job(self.ba_dinh, status=Job.Status.DRAFT)

        self.assertEqual(self.fetch(), {'provinces': [], 'wards': []})
