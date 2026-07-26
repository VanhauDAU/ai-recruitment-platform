from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company, CompanyDocument, RecruiterProfile
from apps.sitecontent.models import SiteSetting

from ..models import Job, JobReport
from ..selectors.verification_badge import job_badge_criteria
from ..services import (
    resolve_job_report,
    reverse_job_report,
    submit_job_report,
)


def _fully_verified_company(suffix='1', *, months_old=12):
    """Nhà tuyển dụng đạt cả năm điều kiện, dùng làm mốc cho từng phép phủ định."""
    user = User.objects.create_user(
        email=f'hr@congty{suffix}.vn',
        password='Password@123',
        role=User.Role.EMPLOYER,
        email_verified=True,
    )
    user.date_joined = timezone.now() - timedelta(days=30 * months_old)
    user.save(update_fields=['date_joined'])
    company = Company.objects.create(
        company_name=f'Công ty {suffix}',
        email=f'contact@congty{suffix}.vn',
        created_by=user,
    )
    RecruiterProfile.objects.create(
        user=user,
        company=company,
        phone_verified_at=timezone.now(),
    )
    CompanyDocument.objects.create(
        company=company,
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        status=CompanyDocument.Status.APPROVED,
        file_url='docs/gpkd.pdf',
        uploaded_by=user,
    )
    return user, company


def _job_for(user, company, suffix=''):
    return Job.objects.create(
        posted_by=user,
        company=company,
        title=f'Chuyên viên SAP {suffix}'.strip(),
        description='Mô tả',
        status=Job.Status.ACTIVE,
    )


class EmployerBadgeCriteriaTests(APITestCase):
    def test_all_five_criteria_met_grants_the_badge(self):
        user, company = _fully_verified_company()
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)

        self.assertTrue(criteria['verified'])
        self.assertTrue(criteria['email_domain_verified'])
        self.assertTrue(criteria['phone_verified'])
        self.assertTrue(criteria['business_doc_approved'])
        self.assertTrue(criteria['account_age_reached'])
        self.assertTrue(criteria['no_report_history'])

    def test_public_mailbox_fails_the_company_domain_criterion(self):
        user, company = _fully_verified_company('2')
        user.email = 'nguoidung@gmail.com'
        user.save(update_fields=['email'])
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)

        self.assertFalse(criteria['email_domain_verified'])
        self.assertFalse(criteria['verified'])

    def test_company_without_business_email_fails_the_domain_criterion(self):
        # Quy tắc cũ cho mọi tên miền không công khai đi qua khi công ty bỏ trống
        # email, nên `hr@ten-mien-bat-ky.vn` cũng đạt tiêu chí.
        user, company = _fully_verified_company('3')
        company.email = ''
        company.save(update_fields=['email'])
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)

        self.assertFalse(criteria['email_domain_verified'])
        self.assertFalse(criteria['verified'])

    def test_account_younger_than_the_configured_threshold_fails(self):
        user, company = _fully_verified_company('4', months_old=1)
        job = _job_for(user, company)

        self.assertFalse(job_badge_criteria(job)['account_age_reached'])

    def test_threshold_of_zero_months_accepts_a_brand_new_account(self):
        SiteSetting.objects.create(
            key='employer_badge_min_account_months',
            label='Tuổi tài khoản tối thiểu',
            value=0,
        )
        user, company = _fully_verified_company('5', months_old=0)
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)

        self.assertTrue(criteria['account_age_reached'])
        self.assertTrue(criteria['verified'])

    def test_only_an_upheld_report_removes_the_badge(self):
        user, company = _fully_verified_company('6')
        dismissed_job = _job_for(user, company, 'bị bác')
        upheld_job = _job_for(user, company, 'vi phạm')
        first_reporter = User.objects.create_user(
            email='ungvien-1@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        second_reporter = User.objects.create_user(
            email='ungvien-2@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        dismissed = submit_job_report(
            job=dismissed_job,
            reporter=first_reporter,
            reason=JobReport.Reason.SCAM,
        )

        self.assertTrue(job_badge_criteria(upheld_job)['no_report_history'])

        resolve_job_report(
            report=dismissed,
            status=JobReport.Status.DISMISSED,
            actor=user,
        )
        self.assertTrue(job_badge_criteria(upheld_job)['no_report_history'])

        upheld = submit_job_report(
            job=upheld_job,
            reporter=second_reporter,
            reason=JobReport.Reason.SCAM,
        )
        resolve_job_report(report=upheld, status=JobReport.Status.UPHELD, actor=user)
        criteria = job_badge_criteria(dismissed_job)
        self.assertFalse(criteria['no_report_history'])
        self.assertFalse(criteria['verified'])

        reverse_job_report(report=upheld, actor=user, note='Đã xác minh lại chứng cứ.')
        self.assertTrue(job_badge_criteria(dismissed_job)['no_report_history'])
        self.assertTrue(job_badge_criteria(dismissed_job)['verified'])

    def test_two_recruiters_in_one_company_have_independent_badges(self):
        owner, company = _fully_verified_company('shared')
        member = User.objects.create_user(
            email='member@congtyshared.vn',
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        member.date_joined = timezone.now() - timedelta(days=365)
        member.save(update_fields=['date_joined'])
        RecruiterProfile.objects.create(
            user=member,
            company=company,
            phone_verified_at=timezone.now(),
        )
        owner_job = _job_for(owner, company, 'owner')
        member_job = _job_for(member, company, 'member')

        self.assertTrue(job_badge_criteria(owner_job)['verified'])
        self.assertFalse(job_badge_criteria(member_job)['business_doc_approved'])

        CompanyDocument.objects.create(
            company=company,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            status=CompanyDocument.Status.APPROVED,
            file_url='docs/member-gpkd.pdf',
            uploaded_by=member,
        )
        self.assertTrue(job_badge_criteria(member_job)['verified'])

        reporter = User.objects.create_user(
            email='candidate-shared@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        report = submit_job_report(
            job=member_job,
            reporter=reporter,
            reason=JobReport.Reason.WRONG_INFO,
        )
        resolve_job_report(report=report, status=JobReport.Status.UPHELD, actor=owner)

        self.assertTrue(job_badge_criteria(owner_job)['verified'])
        self.assertFalse(job_badge_criteria(member_job)['verified'])


class JobBadgeApiTests(APITestCase):
    def test_detail_endpoint_lists_every_criterion_with_its_state(self):
        user, company = _fully_verified_company('7')
        job = Job.objects.create(
            posted_by=user,
            company=company,
            title='Chuyên viên SAP',
            description='Mô tả',
            status=Job.Status.ACTIVE,
        )

        response = self.client.get(reverse('job-detail', kwargs={'slug': job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['company_verified'])
        criteria = response.data['company_verification']['criteria']
        self.assertEqual(
            [item['key'] for item in criteria],
            [
                'email_domain_verified',
                'phone_verified',
                'business_doc_approved',
                'account_age_reached',
                'no_report_history',
            ],
        )
        self.assertTrue(all(item['passed'] for item in criteria))
        self.assertIn('6 tháng', criteria[3]['label'])

    def test_list_endpoint_keeps_badge_queries_flat_across_companies(self):
        for index in range(4):
            user, company = _fully_verified_company(f'list{index}')
            Job.objects.create(
                posted_by=user,
                company=company,
                title=f'Vị trí {index}',
                description='Mô tả',
                status=Job.Status.ACTIVE,
            )

        with self.assertNumQueries(9):
            response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item['company_verified'] for item in response.data['results']))


class JobReportApiTests(APITestCase):
    def setUp(self):
        self.owner, self.company = _fully_verified_company('report')
        self.job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            title='Chuyên viên SAP',
            description='Mô tả',
            status=Job.Status.ACTIVE,
        )
        self.candidate = User.objects.create_user(
            email='ungvien-report@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )

    def _url(self):
        return reverse('job-report-create', kwargs={'public_id': self.job.public_id})

    def test_anonymous_visitor_cannot_report(self):
        response = self.client.post(self._url(), {'reason': JobReport.Reason.SCAM})

        self.assertEqual(response.status_code, 401)

    def test_signed_in_candidate_reports_once_per_job(self):
        self.client.force_authenticate(self.candidate)

        first = self.client.post(self._url(), {'reason': JobReport.Reason.SCAM})
        second = self.client.post(self._url(), {'reason': JobReport.Reason.SCAM})

        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['status'], JobReport.Status.PENDING)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(JobReport.objects.filter(job=self.job).count(), 1)

    def test_other_reason_requires_a_written_detail(self):
        self.client.force_authenticate(self.candidate)

        response = self.client.post(self._url(), {'reason': JobReport.Reason.OTHER})

        self.assertEqual(response.status_code, 400)
        self.assertIn('detail', response.data)
