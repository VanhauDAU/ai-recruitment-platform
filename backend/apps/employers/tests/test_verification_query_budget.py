"""Flat-query budgets for ER-5 verification reads and impact previews."""

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.jobs.models import Job

from ..models import (
    Company,
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    RecruitmentCampaign,
)
from ..selectors import admin_verification_cases_queryset
from ..services import verification_decision_impact, verification_lifecycle_impact
from .readiness_helpers import make_employer_ready

# Measured on PostgreSQL. These are total-query ceilings as well as flatness
# regressions; changing one requires explaining the additional query owner.
ADMIN_VERIFICATION_LIST_QUERY_BUDGET = 4
ADMIN_VERIFICATION_DETAIL_QUERY_BUDGET = 5
VERIFICATION_DECISION_IMPACT_QUERY_BUDGET = 7
VERIFICATION_LIFECYCLE_IMPACT_QUERY_BUDGET = 6


class EmployerVerificationQueryBudgetTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='er5-budget-admin@example.com',
            password='Password@123',
        )
        self.employer = User.objects.create_user(
            email='er5-budget-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='ER-5 Query Budget Company',
            tax_code='0312345601',
            created_by=self.employer,
        )
        self.recruiter = make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        self.case = self.recruiter.verification_case
        self.case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.case.review_started_at = timezone.now()
        self.case.save(update_fields=['status', 'review_started_at', 'updated_at'])
        self._replace_tax_evidence(self.case, self.company, self.employer)
        self.client.force_authenticate(self.admin)

    @staticmethod
    def _replace_tax_evidence(case, company, user):
        case.tax_lookup_evidences.all().delete()
        return CompanyTaxLookupEvidence.objects.create(
            company=company,
            verification_case=case,
            requested_by=user,
            workflow_revision=case.revision,
            tax_code=company.tax_code,
            submitted_company_name=company.company_name,
            status=CompanyTaxLookupEvidence.Status.FOUND,
            returned_tax_code=company.tax_code,
            registered_name=company.company_name,
            response_hash='e' * 64,
            completed_at=timezone.now(),
        )

    @staticmethod
    def _query_count(callback):
        with CaptureQueriesContext(connection) as captured:
            callback()
        return len(captured)

    def _add_case(self, index):
        employer = User.objects.create_user(
            email=f'er5-budget-employer-{index}@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(
            company_name=f'ER-5 Budget Company {index}',
            tax_code=f'03{index:08d}',
            created_by=employer,
        )
        recruiter = make_employer_ready(employer, company=company, candidate_data=True)
        case = recruiter.verification_case
        case.status = EmployerVerificationCase.Status.IN_REVIEW
        case.save(update_fields=['status', 'updated_at'])
        self._replace_tax_evidence(case, company, employer)

    def _add_resources(self, count):
        for index in range(count):
            campaign = RecruitmentCampaign.objects.create(
                owner=self.recruiter,
                company=self.company,
                name=f'ER-5 budget campaign {index}',
                status=RecruitmentCampaign.Status.ACTIVE,
            )
            Job.objects.create(
                posted_by=self.employer,
                company=self.company,
                campaign=campaign,
                title=f'ER-5 budget job {index}',
                description='Flat query resource.',
                status=Job.Status.ACTIVE,
                published_at=timezone.now(),
            )

    def _selected_case(self):
        return admin_verification_cases_queryset(include_detail=True).get(pk=self.case.pk)

    def test_admin_list_and_detail_queries_stay_flat(self):
        list_url = reverse('admin-employer-verification-list')
        detail_url = reverse(
            'admin-employer-verification-detail',
            kwargs={'public_id': self.case.public_id},
        )
        baseline_list = self._query_count(lambda: self.client.get(list_url))
        baseline_detail = self._query_count(lambda: self.client.get(detail_url))
        for index in range(49):
            self._add_case(index)
            CompanyDocument.objects.create(
                company=self.company,
                recruiter=self.recruiter,
                uploaded_by=self.employer,
                verification_case=self.case,
                version=index + 10,
                is_current=False,
                doc_type=CompanyDocument.DocType.IDENTITY_DOCUMENT,
                file_url=f'employers/er5/budget-{index}.pdf',
                status=CompanyDocument.Status.APPROVED,
            )
            EmployerVerificationEvent.objects.create(
                verification_case=self.case,
                actor=self.admin,
                event_type=EmployerVerificationEvent.EventType.DOCUMENT_REVIEWED,
                payload={'index': index},
            )
        expanded_list = self._query_count(lambda: self.client.get(list_url))
        expanded_detail = self._query_count(lambda: self.client.get(detail_url))

        self.assertEqual(expanded_list, baseline_list)
        self.assertEqual(expanded_detail, baseline_detail)
        self.assertLessEqual(expanded_list, ADMIN_VERIFICATION_LIST_QUERY_BUDGET)
        self.assertLessEqual(expanded_detail, ADMIN_VERIFICATION_DETAIL_QUERY_BUDGET)

    def test_decision_impact_queries_stay_flat_as_resources_grow(self):
        self._add_resources(1)
        selected_case = self._selected_case()

        def preview(case):
            verification_decision_impact(
                case,
                actor=self.admin,
                decision=EmployerVerificationCase.Status.APPROVED,
                reason='',
            )

        # The detail selector has its own five-query contract above. Impact
        # owns only the snapshot queries after that read, so RBAC/read overhead
        # cannot be hidden by inflating this budget.
        baseline = self._query_count(lambda: preview(selected_case))
        self._add_resources(49)
        selected_case = self._selected_case()
        expanded = self._query_count(lambda: preview(selected_case))

        self.assertEqual(expanded, baseline)
        self.assertLessEqual(expanded, VERIFICATION_DECISION_IMPACT_QUERY_BUDGET)

    def test_lifecycle_impact_queries_stay_flat_as_resources_grow(self):
        self.case.status = EmployerVerificationCase.Status.APPROVED
        self.case.save(update_fields=['status', 'updated_at'])
        self._add_resources(1)
        selected_case = self._selected_case()

        def preview(case):
            verification_lifecycle_impact(
                case,
                actor=self.admin,
                action=EmployerVerificationCase.Status.REVOKED,
                reason='Query budget preview.',
            )

        baseline = self._query_count(lambda: preview(selected_case))
        self._add_resources(49)
        selected_case = self._selected_case()
        expanded = self._query_count(lambda: preview(selected_case))

        self.assertEqual(expanded, baseline)
        self.assertLessEqual(expanded, VERIFICATION_LIFECYCLE_IMPACT_QUERY_BUDGET)
