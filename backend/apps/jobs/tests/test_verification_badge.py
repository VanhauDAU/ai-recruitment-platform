from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import (
    Company,
    CompanyDocument,
    CompanyDomainClaim,
    EmployerVerificationCase,
    RecruiterProfile,
)
from apps.employers.services import account_badge_eligible_at, employer_badge_payload

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
    company = company or Company.objects.create(
        company_name=f'Công ty {suffix}', email=f'contact@congty{suffix}.vn', created_by=user
    )
    domain = company.email.rsplit('@', 1)[-1]
    user.email = f'hr-{suffix}@{domain}'
    user.phone = f'09{user.pk:08d}'
    user.save(update_fields=['email', 'phone', 'date_joined'])
    recruiter = RecruiterProfile.objects.create(
        user=user,
        company=company,
        company_role=company_role,
        contact_phone=user.phone,
        verified_phone=user.phone,
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
    CompanyDomainClaim.objects.get_or_create(
        company=company,
        domain=domain,
        defaults={
            'requested_by': user,
            'status': CompanyDomainClaim.Status.VERIFIED,
            'verified_at': timezone.now(),
        },
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
    def test_public_payload_never_exposes_criteria_when_rollout_result_is_false(self):
        state = {
            'verified': False,
            'policy_verified': True,
            'minimum_account_months': 6,
            'eligible_at': None,
            'email_domain_verified': True,
            'phone_verified': True,
            'business_doc_approved': True,
            'account_age_reached': True,
            'no_report_history': True,
        }

        self.assertEqual(
            employer_badge_payload(state, expose_failures=False),
            {'verified': False, 'criteria': []},
        )

    def test_all_five_criteria_are_required(self):
        user, company, _, case = _employer_with_verification_case(
            status=EmployerVerificationCase.Status.PENDING
        )
        job = _job_for(user, company)

        criteria = job_badge_criteria(job)
        self.assertFalse(criteria['verified'])
        self.assertFalse(criteria['business_doc_approved'])

        case.status = EmployerVerificationCase.Status.APPROVED
        case.save(update_fields=['status', 'updated_at'])
        criteria = job_badge_criteria(job)
        self.assertTrue(criteria['verified'])
        self.assertTrue(criteria['business_doc_approved'])
        self.assertTrue(criteria['email_domain_verified'])
        self.assertTrue(criteria['phone_verified'])
        self.assertTrue(criteria['account_age_reached'])
        self.assertTrue(criteria['no_report_history'])

        case.status = EmployerVerificationCase.Status.REJECTED
        case.save(update_fields=['status', 'updated_at'])
        criteria = job_badge_criteria(job)
        self.assertFalse(criteria['verified'])
        self.assertFalse(criteria['business_doc_approved'])

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

    @override_settings(EMPLOYER_BADGE_POLICY_MODE='shadow')
    @patch('apps.employers.services.trust_badge.record_metric')
    def test_shadow_keeps_legacy_badge_and_records_policy_cohort(self, metric):
        user, company, _, _ = _employer_with_verification_case('shadow')
        CompanyDomainClaim.objects.filter(company=company).update(
            status=CompanyDomainClaim.Status.REVOKED
        )

        state = job_badge_criteria(_job_for(user, company))

        self.assertTrue(state['legacy_verified'])
        self.assertFalse(state['policy_verified'])
        self.assertTrue(state['verified'])
        metric.assert_called_once_with(
            'employer_badge_policy_shadow',
            1,
            legacy_verified='true',
            policy_verified='false',
        )

    @override_settings(EMPLOYER_BADGE_POLICY_MODE='enforce')
    def test_enforce_removes_badge_when_domain_claim_is_revoked(self):
        user, company, _, _ = _employer_with_verification_case('enforce')
        job = _job_for(user, company)
        CompanyDomainClaim.objects.filter(company=company).update(
            status=CompanyDomainClaim.Status.REVOKED
        )

        state = job_badge_criteria(job)

        self.assertTrue(state['legacy_verified'])
        self.assertFalse(state['policy_verified'])
        self.assertFalse(state['verified'])

    def test_phone_proof_must_still_match_both_current_phone_fields(self):
        user, company, _, _ = _employer_with_verification_case('phone-mismatch')
        job = _job_for(user, company)
        user.phone = '0999999999'
        user.save(update_fields=['phone'])

        state = job_badge_criteria(job)

        self.assertFalse(state['phone_verified'])
        self.assertFalse(state['verified'])

    def test_account_must_reach_calendar_month_threshold(self):
        user, company, _, _ = _employer_with_verification_case('young-account')
        job = _job_for(user, company)
        user.date_joined = timezone.now() - timedelta(days=30)
        user.save(update_fields=['date_joined'])

        state = job_badge_criteria(job)

        self.assertFalse(state['account_age_reached'])
        self.assertFalse(state['verified'])

    def test_current_required_legal_document_must_remain_approved(self):
        user, company, _, case = _employer_with_verification_case('legal-revoked')
        job = _job_for(user, company)
        case.documents.filter(doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION).update(
            status=CompanyDocument.Status.REJECTED
        )

        state = job_badge_criteria(job)

        self.assertFalse(state['business_doc_approved'])
        self.assertFalse(state['verified'])

    def test_authorization_method_fails_when_identity_document_is_missing(self):
        user, company, _, case = _employer_with_verification_case(
            'authorization-missing-id',
            method=EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID,
        )
        job = _job_for(user, company)
        case.documents.filter(doc_type=CompanyDocument.DocType.IDENTITY_DOCUMENT).delete()

        state = job_badge_criteria(job)

        self.assertFalse(state['business_doc_approved'])
        self.assertFalse(state['verified'])

    def test_upheld_trust_report_removes_badge_account_wide(self):
        user, company, _, _ = _employer_with_verification_case('report-history')
        job = _job_for(user, company)
        candidate = User.objects.create_user(
            email='reporter-history@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        JobReport.objects.create(
            job=job,
            reporter=candidate,
            reason=JobReport.Reason.SCAM,
            status=JobReport.Status.UPHELD,
        )

        state = job_badge_criteria(job)

        self.assertFalse(state['no_report_history'])
        self.assertFalse(state['verified'])

    def test_restricted_account_fails_closed_even_with_all_five_evidence_records(self):
        user, company, _, _ = _employer_with_verification_case('restricted')
        job = _job_for(user, company)
        user.status = User.Status.BANNED
        user.save(update_fields=['status'])

        state = job_badge_criteria(job)

        self.assertFalse(state['verified'])

    def test_calendar_month_addition_clamps_month_end(self):
        user, _, _, _ = _employer_with_verification_case('month-end')
        joined = timezone.datetime(2024, 8, 31, 8, 30, tzinfo=timezone.get_current_timezone())
        user.date_joined = joined

        eligible_at = account_badge_eligible_at(user, 6)

        self.assertEqual(eligible_at.date(), timezone.datetime(2025, 2, 28).date())

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
            [
                'email_domain_verified',
                'phone_verified',
                'business_doc_approved',
                'account_age_reached',
                'no_report_history',
            ],
        )
        self.assertTrue(all(item['passed'] for item in criteria))
        self.assertIn('tên miền', criteria[0]['label'])

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

        with self.assertNumQueries(8):
            response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item['company_verified'] for item in response.data['results']))

    def test_unverified_public_payload_does_not_disclose_failed_criteria_or_account_age(self):
        user, company, _, _ = _employer_with_verification_case('private-failures')
        job = _job_for(user, company)
        CompanyDomainClaim.objects.filter(company=company).update(
            status=CompanyDomainClaim.Status.REVOKED
        )

        response = self.client.get(reverse('job-detail', kwargs={'slug': job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data['company_verification'],
            {'verified': False, 'criteria': []},
        )

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


class EmployerBadgeAuditCommandTests(APITestCase):
    @override_settings(EMPLOYER_BADGE_POLICY_MODE='enforce')
    def test_command_emits_only_aggregate_cohorts_and_failure_counts(self):
        user, company, _, _ = _employer_with_verification_case('audit-command')
        _job_for(user, company)
        output = StringIO()

        call_command('audit_employer_badge_policy', stdout=output)

        value = output.getvalue()
        self.assertIn('total_recruiters=1', value)
        self.assertIn('legacy_and_policy=1', value)
        self.assertIn('failed_email_domain_verified=0', value)
        self.assertNotIn('@', value)
        self.assertNotIn(user.public_id, value)


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
        self.assertEqual(set(first.data), {'public_id', 'status', 'created_at'})
        self.assertEqual(first.data['status'], JobReport.Status.PENDING)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(JobReport.objects.filter(job=self.job).count(), 1)

    def test_employer_cannot_report_a_competitors_job(self):
        competitor, _, _, _ = _employer_with_verification_case('report-competitor')
        self.client.force_authenticate(competitor)

        response = self.client.post(self._url(), {'reason': JobReport.Reason.SCAM})

        self.assertEqual(response.status_code, 403)

    def test_candidate_cannot_report_a_non_public_job(self):
        self.job.status = Job.Status.DRAFT
        self.job.save(update_fields=['status'])
        self.client.force_authenticate(self.candidate)

        response = self.client.post(self._url(), {'reason': JobReport.Reason.SCAM})

        self.assertEqual(response.status_code, 404)

    def test_other_reason_requires_a_written_detail(self):
        self.client.force_authenticate(self.candidate)

        response = self.client.post(self._url(), {'reason': JobReport.Reason.OTHER})

        self.assertEqual(response.status_code, 400)
        self.assertIn('detail', response.data)
