from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.services import create_v2_cv
from apps.employers.models import Company
from apps.jobs.models import Job

from ..services import create_application_record


class AdminJobApplicationListTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employer = user_model.objects.create_user(
            email='application-owner@example.com',
            password='password',
            role=user_model.Role.EMPLOYER,
        )
        self.admin = user_model.objects.create_user(
            email='application-admin@example.com',
            password='password',
            role=user_model.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.limited_admin = user_model.objects.create_user(
            email='limited-application-admin@example.com',
            password='password',
            role=user_model.Role.ADMIN,
        )
        department = Department.objects.create(code='applications-audit', name='Kiểm tra hồ sơ')
        role = AdminRole.objects.create(department=department, code='viewer', name='Người xem')
        role.permissions.add(
            AdminPermission.objects.create(
                code='job_moderation.view',
                module='job_moderation',
                label='Xem tin tuyển dụng',
            )
        )
        assign_membership(self.limited_admin, role, actor=self.admin)
        company = Company.objects.create(
            company_name='Application Audit Co', created_by=self.employer
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Platform Engineer',
            description='Build the platform.',
            status=Job.Status.ACTIVE,
        )
        template, _version = make_published_template('Admin application template')
        self.applications = []
        for index in range(5):
            candidate = user_model.objects.create_user(
                email=f'candidate-{index}@example.com',
                password='password',
                role=user_model.Role.CANDIDATE,
                full_name=f'Ứng viên {index}',
                email_verified=True,
            )
            cv = create_v2_cv(actor=candidate, title=f'CV Platform {index}', template=template)
            self.applications.append(
                create_application_record(
                    candidate=candidate,
                    job=self.job,
                    cv=cv,
                    cover_letter=f'Thư ứng tuyển {index}',
                    contact_name=f'Liên hệ {index}',
                    contact_email=f'contact-{index}@example.com',
                    contact_phone=f'090000000{index}',
                    data_processing_consent=True,
                )
            )

    def url(self):
        return reverse(
            'admin-job-application-list-v2',
            kwargs={'job_public_id': self.job.public_id},
        )

    def test_authorized_admin_can_filter_and_read_application_contact(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            self.url(),
            {'q': 'candidate-3', 'status': 'submitted', 'ordering': 'name'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['count'], 1)
        application = response.data['results'][0]
        self.assertEqual(application['candidate_name'], 'Ứng viên 3')
        self.assertEqual(application['contact_phone'], '0900000003')
        self.assertEqual(application['submitted_cv_title'], 'CV Platform 3')
        self.assertTrue(application['data_processing_consent'])

    def test_sensitive_contact_permission_is_required(self):
        self.client.force_authenticate(self.limited_admin)

        response = self.client.get(self.url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_application_list_query_count_is_flat(self):
        self.client.force_authenticate(self.admin)

        # 1 job lookup + 1 pagination count + 1 joined list + 1 locations prefetch.
        with self.assertNumQueries(4):
            response = self.client.get(self.url())

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(response.data['results']), 5)
