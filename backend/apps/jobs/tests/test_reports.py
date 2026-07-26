from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.employers.models import Company, CompanyDocument, RecruiterProfile

from ..models import Job, JobReport, JobReportResolutionEvent
from ..selectors.verification_badge import job_badge_criteria
from ..services import resolve_job_report, submit_job_report


def _employer_job(suffix):
    user_model = get_user_model()
    employer = user_model.objects.create_user(
        email=f'poster-{suffix}@company-{suffix}.vn',
        password='Password@123',
        role=user_model.Role.EMPLOYER,
        email_verified=True,
    )
    employer.date_joined = timezone.now() - timedelta(days=365)
    employer.save(update_fields=['date_joined'])
    company = Company.objects.create(
        company_name=f'Company {suffix}',
        email=f'contact@company-{suffix}.vn',
        created_by=employer,
    )
    RecruiterProfile.objects.create(
        user=employer,
        company=company,
        phone_verified_at=timezone.now(),
    )
    CompanyDocument.objects.create(
        company=company,
        uploaded_by=employer,
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        status=CompanyDocument.Status.APPROVED,
        file_url=f'docs/{suffix}.pdf',
    )
    job = Job.objects.create(
        posted_by=employer,
        company=company,
        title=f'Backend Engineer {suffix}',
        description='Build reliable services.',
        status=Job.Status.ACTIVE,
    )
    return employer, job


def _admin_with_permissions(email, codes):
    user_model = get_user_model()
    admin = user_model.objects.create_user(
        email=email,
        password='Password@123',
        role=user_model.Role.ADMIN,
    )
    department = Department.objects.create(
        code=f'department-{admin.pk}',
        name=f'Department {admin.pk}',
    )
    role = AdminRole.objects.create(
        department=department,
        code='staff',
        name='Nhân viên',
    )
    permissions = [
        AdminPermission.objects.get_or_create(
            code=code,
            defaults={'module': 'job_moderation', 'label': code},
        )[0]
        for code in codes
    ]
    role.permissions.add(*permissions)
    assign_membership(admin, role, actor=admin)
    return admin


class JobReportAdminApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employer, self.job = _employer_job('api')
        self.candidate = user_model.objects.create_user(
            email='candidate-report-api@example.com',
            password='Password@123',
            role=user_model.Role.CANDIDATE,
        )
        self.report = submit_job_report(
            job=self.job,
            reporter=self.candidate,
            reason=JobReport.Reason.SCAM,
            detail='Tin yêu cầu ứng viên đóng phí.',
        )
        self.viewer = _admin_with_permissions(
            'report-viewer@example.com',
            {'job_moderation.view'},
        )
        self.resolver = _admin_with_permissions(
            'report-resolver@example.com',
            {'job_moderation.view', 'job_moderation.resolve_report'},
        )

    def resolve_url(self):
        return reverse(
            'admin-job-report-resolve',
            kwargs={'public_id': self.report.public_id},
        )

    def reverse_url(self):
        return reverse(
            'admin-job-report-reverse',
            kwargs={'public_id': self.report.public_id},
        )

    def test_view_permission_lists_but_cannot_resolve_reports(self):
        self.client.force_authenticate(self.viewer)

        listing = self.client.get(
            reverse('admin-job-report-list'),
            {'status': JobReport.Status.PENDING},
        )
        forbidden = self.client.post(
            self.resolve_url(),
            {'status': JobReport.Status.UPHELD},
            format='json',
        )

        self.assertEqual(listing.status_code, status.HTTP_200_OK, listing.data)
        self.assertEqual(listing.data['count'], 1)
        self.assertEqual(listing.data['results'][0]['job_slug'], self.job.slug)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_resolve_and_reverse_keep_an_auditable_history(self):
        self.client.force_authenticate(self.resolver)

        resolved = self.client.post(
            self.resolve_url(),
            {'status': JobReport.Status.UPHELD, 'note': 'Đã đối chiếu chứng cứ.'},
            format='json',
        )

        self.assertEqual(resolved.status_code, status.HTTP_200_OK, resolved.data)
        self.assertEqual(resolved.data['status'], JobReport.Status.UPHELD)
        self.assertEqual(len(resolved.data['resolution_history']), 1)
        self.assertFalse(job_badge_criteria(self.job)['verified'])

        missing_note = self.client.post(self.reverse_url(), {'note': ''}, format='json')
        self.assertEqual(missing_note.status_code, status.HTTP_400_BAD_REQUEST)

        reversed_response = self.client.post(
            self.reverse_url(),
            {'note': 'Khiếu nại cung cấp bằng chứng hợp lệ.'},
            format='json',
        )
        self.assertEqual(reversed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reversed_response.data['status'], JobReport.Status.DISMISSED)
        self.assertEqual(
            [
                (item['from_status'], item['to_status'])
                for item in reversed_response.data['resolution_history']
            ],
            [
                (JobReport.Status.PENDING, JobReport.Status.UPHELD),
                (JobReport.Status.UPHELD, JobReport.Status.DISMISSED),
            ],
        )
        self.assertTrue(job_badge_criteria(self.job)['verified'])
        self.assertEqual(
            JobReportResolutionEvent.objects.filter(report=self.report).count(),
            2,
        )


class JobReportConcurrencyTests(TransactionTestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employer, self.job = _employer_job('concurrent')
        self.admin = user_model.objects.create_user(
            email='report-concurrent-admin@example.com',
            password='Password@123',
            role=user_model.Role.ADMIN,
        )
        candidate = user_model.objects.create_user(
            email='report-concurrent-candidate@example.com',
            password='Password@123',
            role=user_model.Role.CANDIDATE,
        )
        self.report = submit_job_report(
            job=self.job,
            reporter=candidate,
            reason=JobReport.Reason.WRONG_INFO,
        )

    def test_simultaneous_resolutions_record_exactly_one_transition(self):
        gate = Barrier(2)

        def resolve_once():
            close_old_connections()
            try:
                stale_report = JobReport.objects.get(pk=self.report.pk)
                gate.wait(timeout=5)
                try:
                    resolve_job_report(
                        report=stale_report,
                        status=JobReport.Status.UPHELD,
                        actor=self.admin,
                    )
                except ValidationError:
                    return 'already-resolved'
                return 'resolved'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: resolve_once(), range(2)))

        self.assertCountEqual(outcomes, ['resolved', 'already-resolved'])
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, JobReport.Status.UPHELD)
        self.assertEqual(self.report.resolution_history.count(), 1)
