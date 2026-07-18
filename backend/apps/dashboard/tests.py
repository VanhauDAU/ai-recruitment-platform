from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company, RecruiterProfile, RecruitmentNeed
from apps.jobs.models import Job, JobCategory


class EmployerDashboardApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='dashboard-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            full_name='Nguyễn An',
            email_verified=True,
        )
        company = Company.objects.create(
            company_name='Công ty Acme', tax_code='0101234567', created_by=self.user,
        )
        recruiter = RecruiterProfile.objects.create(
            user=self.user,
            company=company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
            membership_status=RecruiterProfile.MembershipStatus.APPROVED,
            registration_completed_at=timezone.now(),
        )
        category = JobCategory.objects.create(
            name='Kinh doanh phần mềm',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        RecruitmentNeed.objects.create(
            recruiter=recruiter,
            position_category=category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            target_date=timezone.localdate() + timedelta(days=30),
            headcount=3,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=timezone.now(),
        )
        Job.objects.create(
            posted_by=self.user,
            company=company,
            title='Nhân viên kinh doanh',
            description='Mô tả công việc',
            status=Job.Status.ACTIVE,
            view_count=120,
            application_count=4,
        )
        Job.objects.create(
            posted_by=self.user,
            company=company,
            title='Trưởng nhóm bán hàng',
            description='Mô tả công việc',
            status=Job.Status.PENDING,
            view_count=10,
        )
        self.client.force_authenticate(user=self.user)

    def test_employer_dashboard_returns_real_summary_and_recent_work(self):
        response = self.client.get(reverse('employer-dashboard'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['account']['company_name'], 'Công ty Acme')
        self.assertTrue(response.data['account']['verification']['account_ready'])
        self.assertEqual(response.data['summary']['jobs_total'], 2)
        self.assertEqual(response.data['summary']['jobs_active'], 1)
        self.assertEqual(response.data['summary']['jobs_pending'], 1)
        self.assertEqual(response.data['summary']['job_views'], 130)
        self.assertEqual(response.data['summary']['applications_total'], 0)
        self.assertEqual(response.data['recruitment_need']['position_category_name'], 'Kinh doanh phần mềm')
        self.assertEqual(response.data['recruitment_need']['headcount'], 3)
        self.assertEqual(len(response.data['application_activity']), 7)
        self.assertEqual(len(response.data['recent_jobs']), 2)

    def test_candidate_cannot_read_employer_dashboard(self):
        candidate = User.objects.create_user(
            email='candidate-dashboard@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        self.client.force_authenticate(user=candidate)

        response = self.client.get(reverse('employer-dashboard'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
