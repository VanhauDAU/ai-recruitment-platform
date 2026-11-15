from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.tests.helpers import make_admin
from apps.applications.models import Application
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job, JobCategory, JobCategoryAssignment, JobReport
from apps.jobs.tests.helpers import open_visibility_window


class AdminDashboardApiTests(APITestCase):
    url = reverse('admin-dashboard')

    def setUp(self):
        self.admin = make_admin('dashboard-admin@example.com')
        self.employer = User.objects.create_user(
            email='dashboard-admin-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Công ty Dashboard',
            tax_code='0109876543',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        self.category = JobCategory.objects.create(
            name='Backend Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.client.force_authenticate(self.admin)

    def _job(self, title='Lập trình viên', **extra):
        job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Mô tả',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
            **open_visibility_window(),
            **extra,
        )
        JobCategoryAssignment.objects.create(
            job=job,
            category=self.category,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        return job

    def _apply(self, job, email, **fields):
        candidate = User.objects.create_user(
            email=email, password='Password@123', role=User.Role.CANDIDATE
        )
        cv = UserCv.objects.create(user=candidate, title='CV')
        return Application.objects.create(
            candidate=candidate,
            job=job,
            cv=cv,
            submitted_cv_version=create_initial_document(cv, candidate),
            submitted_cv_title=cv.title,
            **fields,
        )

    def test_only_admin_portal_can_read_dashboard(self):
        self.client.force_authenticate(self.employer)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_period_falls_back_to_thirty_days(self):
        for raw, expected in (('7', 7), ('90', 90), ('15', 30), ('abc', 30)):
            response = self.client.get(self.url, {'period': raw})
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            self.assertEqual(response.data['period']['days'], expected)
            self.assertEqual(len(response.data['activity']), expected)

    def test_queue_reports_count_overdue_and_oldest(self):
        job = self._job()
        fresh = JobReport.objects.create(job=job, reason=JobReport.Reason.SCAM)
        old = JobReport.objects.create(job=job, reason=JobReport.Reason.OTHER)
        stale_at = timezone.now() - timedelta(hours=60)
        JobReport.objects.filter(pk=old.pk).update(created_at=stale_at)
        JobReport.objects.create(
            job=job, reason=JobReport.Reason.OTHER, status=JobReport.Status.DISMISSED
        )

        response = self.client.get(self.url)

        queue = next(item for item in response.data['queues'] if item['key'] == 'job_reports')
        self.assertEqual(queue['count'], 2)
        self.assertEqual(queue['overdue'], 1)
        self.assertEqual(queue['sla_hours'], 48)
        self.assertLess(queue['oldest_at'], fresh.created_at.isoformat())

    def test_kpis_compare_current_with_previous_period(self):
        previous = timezone.now() - timedelta(days=10)
        older = User.objects.create_user(
            email='old-candidate@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        User.objects.filter(pk=older.pk).update(date_joined=previous)
        User.objects.create_user(
            email='new-candidate@example.com', password='Password@123', role=User.Role.CANDIDATE
        )

        response = self.client.get(self.url, {'period': 7})

        self.assertEqual(response.data['kpis']['candidates'], {'current': 1, 'previous': 1})
        self.assertEqual(response.data['totals']['candidates'], 2)
        self.assertEqual(response.data['activity'][-1]['candidates'], 1)

    def test_funnel_counts_stages_reached_and_top_categories(self):
        job = self._job()
        self._job(title='Không có hồ sơ')
        now = timezone.now()
        self._apply(job, 'a@example.com')
        self._apply(
            job,
            'b@example.com',
            status=Application.Status.SHORTLISTED,
            viewed_at=now,
            shortlisted_at=now,
        )

        response = self.client.get(self.url)

        funnel = response.data['applications']['funnel']
        self.assertEqual(
            (funnel['submitted'], funnel['viewed'], funnel['shortlisted']),
            (2, 1, 1),
        )
        self.assertEqual(response.data['jobs']['without_applications'], 1)
        self.assertEqual(
            response.data['top_categories'],
            [
                {
                    'public_id': self.category.public_id,
                    'name': 'Backend Developer',
                    'active_jobs': 2,
                    'applications': 2,
                }
            ],
        )

    def test_query_count_does_not_grow_with_data(self):
        def count_queries():
            with CaptureQueriesContext(connection) as context:
                self.client.get(self.url)
            return len(context)

        baseline = count_queries()
        for index in range(4):
            job = self._job(title=f'Tin {index}')
            JobReport.objects.create(job=job, reason=JobReport.Reason.OTHER)
            self._apply(job, f'candidate-{index}@example.com')

        self.assertEqual(count_queries(), baseline)
