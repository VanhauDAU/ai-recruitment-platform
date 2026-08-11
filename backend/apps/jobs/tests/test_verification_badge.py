from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import (
    Company,
    CompanyDocument,
    EmployerVerificationCase,
    RecruiterProfile,
)

from ..models import Job, JobReport
from ..selectors.verification_badge import job_badge_criteria


def _employer_with_verification_case(
    suffix='1',
    *,
    company=None,
    company_role=RecruiterProfile.CompanyRole.OWNER,
    status=EmployerVerificationCase.Status.APPROVED,
    method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
):
    user = User.objects.create_user(
        email=f'hr@congty{suffix}.vn',
        password='Password@123',
        role=User.Role.EMPLOYER,
        email_verified=True,
    )
    # Giữ đủ các tín hiệu của huy hiệu cũ để chứng minh chúng không còn có thể
    # vượt qua quyết định cuối cùng trên EmployerVerificationCase.
    user.date_joined = timezone.now() - timedelta(days=365)
    user.save(update_fields=['date_joined'])
    company = company or Company.objects.create(
        company_name=f'Công ty {suffix}', email=f'contact@congty{suffix}.vn', created_by=user
    )
    recruiter = RecruiterProfile.objects.create(
        user=user,
        company=company,
        company_role=company_role,
        phone_verified_at=timezone.now(),
    )
    case = EmployerVerificationCase.objects.create(
        recruiter=recruiter,
        company=company,
        status=status,
        verification_method=method,
    )
    doc_types = (
        [CompanyDocument.DocType.BUSINESS_REGISTRATION]
        if method == EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
        else [
            CompanyDocument.DocType.AUTHORIZATION_LETTER,
            CompanyDocument.DocType.IDENTITY_DOCUMENT,
        ]
    )
    for doc_type in doc_types:
        CompanyDocument.objects.create(
            company=company,
            recruiter=recruiter,
            verification_case=case,
            doc_type=doc_type,
            status=CompanyDocument.Status.APPROVED,
            file_url=f'docs/{suffix}-{doc_type}.pdf',
            uploaded_by=user,
        )
    return user, company, recruiter, case


def _job_for(user, company, suffix=''):
    return Job.objects.create(
        posted_by=user,
        company=company,
        title=f'Chuyên viên SAP {suffix}'.strip(),
        description='Mô tả',
        status=Job.Status.ACTIVE,
    )


class EmployerBadgeCriteriaTests(APITestCase):
    def test_only_an_approved_recruiter_case_grants_the_badge(self):
        user, company, _, case = _employer_with_verification_case(
            status=EmployerVerificationCase.Status.PENDING
        )
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)
        self.assertFalse(criteria['verified'])
        self.assertFalse(criteria['employer_verification_approved'])

        case.status = EmployerVerificationCase.Status.APPROVED
        case.save(update_fields=['status', 'updated_at'])
        criteria = job_badge_criteria(job)
        self.assertTrue(criteria['verified'])
        self.assertTrue(criteria['employer_verification_approved'])

        case.status = EmployerVerificationCase.Status.REJECTED
        case.save(update_fields=['status', 'updated_at'])
        criteria = job_badge_criteria(job)
        self.assertFalse(criteria['verified'])
        self.assertFalse(criteria['employer_verification_approved'])

    def test_approved_authorization_case_grants_the_badge_without_business_registration(self):
        user, company, _, _ = _employer_with_verification_case(
            'authorization',
            company_role=RecruiterProfile.CompanyRole.MEMBER,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
        )
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)

        self.assertTrue(criteria['verified'])
        self.assertFalse(
            CompanyDocument.objects.filter(
                verification_case__recruiter__user=user,
                doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            ).exists()
        )

    def test_owner_and_member_in_one_company_have_independent_case_badges(self):
        owner, company, _, _ = _employer_with_verification_case('shared-owner')
        member, _, _, member_case = _employer_with_verification_case(
            'shared-member',
            company=company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
            status=EmployerVerificationCase.Status.PENDING,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
        )
        owner_job = _job_for(owner, company, 'owner')
        member_job = _job_for(member, company, 'member')

        self.assertTrue(job_badge_criteria(owner_job)['verified'])
        self.assertFalse(job_badge_criteria(member_job)['verified'])

        member_case.status = EmployerVerificationCase.Status.APPROVED
        member_case.save(update_fields=['status', 'updated_at'])
        self.assertTrue(job_badge_criteria(member_job)['verified'])
        self.assertTrue(job_badge_criteria(owner_job)['verified'])

    def test_approved_case_for_an_old_company_does_not_badge_a_new_company_job(self):
        user, old_company, recruiter, _ = _employer_with_verification_case('old-company')
        new_company = Company.objects.create(
            company_name='Công ty mới',
            created_by=user,
        )
        recruiter.company = new_company
        recruiter.save(update_fields=['company', 'updated_at'])
        job = _job_for(user, new_company)

        self.assertFalse(job_badge_criteria(job)['verified'])
        self.assertNotEqual(old_company.pk, new_company.pk)


class JobBadgeApiTests(APITestCase):
    def test_detail_endpoint_exposes_approved_recruiter_under_legacy_field_names(self):
        user, company, _, _ = _employer_with_verification_case('7')
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
            ['employer_verification_approved'],
        )
        self.assertTrue(all(item['passed'] for item in criteria))
        self.assertIn('nhà tuyển dụng', criteria[0]['label'])
        self.assertIn('người đăng tin', criteria[0]['label'])

    def test_list_endpoint_keeps_badge_queries_flat_across_companies(self):
        for index in range(4):
            user, company, _, _ = _employer_with_verification_case(f'list{index}')
            Job.objects.create(
                posted_by=user,
                company=company,
                title=f'Vị trí {index}',
                description='Mô tả',
                status=Job.Status.ACTIVE,
            )

        with self.assertNumQueries(6):
            response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item['company_verified'] for item in response.data['results']))

    def test_list_endpoint_does_not_share_one_recruiters_approval_across_company(self):
        owner, company, _, _ = _employer_with_verification_case('api-owner')
        member, _, _, _ = _employer_with_verification_case(
            'api-member',
            company=company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
            status=EmployerVerificationCase.Status.PENDING,
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
        )
        owner_job = _job_for(owner, company, 'owner API')
        member_job = _job_for(member, company, 'member API')

        response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200, response.data)
        badges = {item['public_id']: item['company_verified'] for item in response.data['results']}
        self.assertTrue(badges[owner_job.public_id])
        self.assertFalse(badges[member_job.public_id])


class JobReportApiTests(APITestCase):
    def setUp(self):
        self.owner, self.company, _, _ = _employer_with_verification_case('report')
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
