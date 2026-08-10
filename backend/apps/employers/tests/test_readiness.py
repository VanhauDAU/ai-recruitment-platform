"""Canonical employer-readiness policy and API contract tests."""

from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.jobs.models import Job, JobCategory

from ..models import (
    Company,
    CompanyDocument,
    EmployerDpaAcceptance,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentNeed,
)
from ..selectors import DpaStatus, evaluate_employer_readiness


def _policy(*, dpa_status=DpaStatus.CURRENT, verification_status='approved', account='active'):
    return evaluate_employer_readiness(
        account_state=account,
        initial_onboarding_complete=True,
        phone_verified=True,
        company_linked=True,
        business_document_submitted=True,
        candidate_dpa_submitted=True,
        verification_case_status=verification_status,
        dpa_status=dpa_status,
    )


class EmployerReadinessPolicyTests(SimpleTestCase):
    def test_current_dpa_and_approved_verification_unlock_all_capabilities(self):
        state = _policy()

        self.assertTrue(state['job_workspace_ready'])
        self.assertTrue(state['verification_approved'])
        self.assertTrue(state['candidate_data_access'])
        self.assertEqual(state['dpa_status'], 'current')
        self.assertEqual(state['blockers'], [])

    def test_verification_is_independent_from_workspace(self):
        state = _policy(verification_status='changes_requested')

        self.assertTrue(state['job_workspace_ready'])
        self.assertFalse(state['verification_approved'])
        self.assertFalse(state['candidate_data_access'])
        self.assertEqual([item['code'] for item in state['blockers']], ['verification_required'])

    def test_outdated_grace_and_legacy_dpa_keep_workspace_but_block_candidate_data(self):
        for dpa_status in (
            DpaStatus.OUTDATED,
            DpaStatus.GRACE,
            DpaStatus.LEGACY_UNVERSIONED,
        ):
            with self.subTest(dpa_status=dpa_status):
                state = _policy(dpa_status=dpa_status)
                self.assertTrue(state['job_workspace_ready'])
                self.assertTrue(state['verification_approved'])
                self.assertFalse(state['candidate_data_access'])
                self.assertIn(
                    'candidate_data',
                    state['blockers'][0]['capabilities'],
                )

    def test_missing_hold_unknown_and_invalid_dpa_fail_workspace_closed(self):
        for dpa_status in (
            DpaStatus.MISSING,
            DpaStatus.HOLD,
            DpaStatus.UNKNOWN,
            'future-invalid-value',
        ):
            with self.subTest(dpa_status=dpa_status):
                state = _policy(dpa_status=dpa_status)
                self.assertFalse(state['job_workspace_ready'])
                self.assertFalse(state['candidate_data_access'])

    def test_restricted_and_unknown_account_states_fail_all_capabilities_closed(self):
        for account_state in (User.Status.INACTIVE, User.Status.BANNED, 'future-state'):
            with self.subTest(account_state=account_state):
                state = _policy(account=account_state)
                self.assertFalse(state['job_workspace_ready'])
                self.assertFalse(state['verification_approved'])
                self.assertFalse(state['candidate_data_access'])
                self.assertIn(
                    state['blockers'][0]['code'],
                    {'account_restricted', 'account_state_unknown'},
                )

    def test_blocker_contract_uses_lowercase_codes_and_machine_actions(self):
        state = evaluate_employer_readiness(
            account_state=User.Status.ACTIVE,
            initial_onboarding_complete=False,
            phone_verified=False,
            company_linked=False,
            business_document_submitted=False,
            candidate_dpa_submitted=False,
            verification_case_status=None,
            dpa_status=DpaStatus.MISSING,
        )

        self.assertTrue(state['blockers'])
        for blocker in state['blockers']:
            self.assertEqual(blocker['code'], blocker['code'].lower())
            self.assertEqual(
                set(blocker),
                {'code', 'capabilities', 'message', 'action'},
            )
            self.assertTrue(blocker['capabilities'])
            self.assertTrue(blocker['message'])
            self.assertTrue(blocker['action'])

    def test_candidate_data_is_a_strict_superset_of_workspace_prerequisites(self):
        state = evaluate_employer_readiness(
            account_state=User.Status.ACTIVE,
            initial_onboarding_complete=True,
            phone_verified=True,
            company_linked=False,
            business_document_submitted=True,
            candidate_dpa_submitted=True,
            verification_case_status=EmployerVerificationCase.Status.APPROVED,
            dpa_status=DpaStatus.CURRENT,
        )

        self.assertFalse(state['job_workspace_ready'])
        self.assertTrue(state['verification_approved'])
        self.assertFalse(state['candidate_data_access'])
        company_blocker = next(
            blocker for blocker in state['blockers'] if blocker['code'] == 'company_link_required'
        )
        self.assertEqual(company_blocker['capabilities'], ['job_workspace', 'candidate_data'])


class EmployerReadinessContractTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='readiness-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        self.company = Company.objects.create(
            company_name='Công ty Readiness',
            tax_code='0108887777',
            created_by=self.user,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
            registration_completed_at=timezone.now(),
            phone_verified_at=timezone.now(),
            verified_phone='0911222333',
            dpa_accepted_at=timezone.now(),
            dpa_policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
            dpa_document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
        )
        EmployerDpaAcceptance.objects.create(
            recruiter=self.recruiter,
            policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
            document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
            document_url=settings.EMPLOYER_DPA_DOCUMENT_URL,
            ip_address='127.0.0.1',
        )
        category = JobCategory.objects.create(
            name='Readiness backend',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        RecruitmentNeed.objects.create(
            recruiter=self.recruiter,
            position_category=category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            target_date=timezone.localdate() + timedelta(days=30),
            headcount=1,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=timezone.now(),
        )
        self.case = EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=self.company,
            status=EmployerVerificationCase.Status.PENDING,
            submitted_at=timezone.now(),
        )
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.create(
                company=self.company,
                recruiter=self.recruiter,
                uploaded_by=self.user,
                verification_case=self.case,
                doc_type=doc_type,
                file_url=f'employers/readiness/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                mime_type='application/pdf',
                file_size=100,
                status=CompanyDocument.Status.PENDING,
            )
        self.client.force_authenticate(self.user)

    def test_employer_me_returns_canonical_readiness_without_requiring_approval(self):
        response = self.client.get(reverse('employer-me'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['job_workspace_ready'])
        self.assertFalse(response.data['verification_approved'])
        self.assertFalse(response.data['candidate_data_access'])
        self.assertEqual(response.data['dpa_status'], 'current')
        self.assertEqual(
            [item['code'] for item in response.data['blockers']],
            ['verification_required'],
        )

    def test_session_adds_workspace_field_and_preserves_legacy_verification_field(self):
        response = self.client.get(reverse('auth-me'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['employer_job_workspace_ready'])
        self.assertIn('employer_verification_completed', response.data)

    def test_approved_case_unlocks_candidate_data(self):
        self.case.status = EmployerVerificationCase.Status.APPROVED
        self.case.save(update_fields=['status', 'updated_at'])

        response = self.client.get(reverse('employer-me'))

        self.assertTrue(response.data['job_workspace_ready'])
        self.assertTrue(response.data['verification_approved'])
        self.assertTrue(response.data['candidate_data_access'])
        self.assertEqual(response.data['blockers'], [])

    def test_documents_from_a_previous_company_cannot_unlock_a_new_company(self):
        replacement = Company.objects.create(
            company_name='Công ty mới',
            tax_code='0108887799',
            created_by=self.user,
        )
        self.recruiter.company = replacement
        self.recruiter.save(update_fields=['company', 'updated_at'])

        response = self.client.get(reverse('employer-me'))

        self.assertFalse(response.data['job_workspace_ready'])
        self.assertFalse(response.data['verification_approved'])
        self.assertFalse(response.data['candidate_data_access'])
        self.assertIn(
            'business_document_required',
            [blocker['code'] for blocker in response.data['blockers']],
        )
        self.assertIn(
            'candidate_dpa_document_required',
            [blocker['code'] for blocker in response.data['blockers']],
        )

    def test_deleted_account_adapter_fails_closed_even_when_status_is_active(self):
        self.user.is_deleted = True
        self.user.save(update_fields=['is_deleted', 'updated_at'])

        state = evaluate_employer_readiness(
            account_state=self.user.status,
            account_accessible=False,
            initial_onboarding_complete=True,
            phone_verified=True,
            company_linked=True,
            business_document_submitted=True,
            candidate_dpa_submitted=True,
            verification_case_status=EmployerVerificationCase.Status.APPROVED,
            dpa_status=DpaStatus.CURRENT,
        )

        self.assertFalse(state['job_workspace_ready'])
        self.assertFalse(state['verification_approved'])
        self.assertFalse(state['candidate_data_access'])

    def test_session_readiness_query_budget_is_flat(self):
        def query_count():
            authenticated_user = User.objects.get(pk=self.user.pk)
            self.client.force_authenticate(authenticated_user)
            with CaptureQueriesContext(connection) as captured:
                response = self.client.get(reverse('auth-me'))
            self.assertEqual(response.status_code, 200, response.data)
            return len(captured)

        baseline = query_count()
        category = self.recruiter.recruitment_needs.first().position_category
        for index in range(5):
            RecruitmentNeed.objects.create(
                recruiter=self.recruiter,
                position_category=category,
                position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
                target_date=timezone.localdate() + timedelta(days=40 + index),
                headcount=index + 1,
                budget_source=RecruitmentNeed.BudgetSource.COMPANY,
                completed_at=timezone.now(),
            )
            Job.objects.create(
                posted_by=self.user,
                company=self.company,
                title=f'Tin readiness {index}',
                description='Mô tả',
                status=Job.Status.DRAFT,
            )

        expanded = query_count()
        self.assertEqual(expanded, baseline)
        self.assertLessEqual(expanded, 12)
