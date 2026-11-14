"""Checklist flags must follow the current verification case decision."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import Company, EmployerVerificationCase
from ..selectors.onboarding import build_employer_onboarding_steps
from .readiness_helpers import make_employer_ready


class VerificationChecklistInvalidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='checklist-owner@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Checklist Co', created_by=self.user)
        self.recruiter = make_employer_ready(self.user, company=self.company, candidate_data=True)

    def _set_case_status(self, status):
        EmployerVerificationCase.objects.filter(recruiter=self.recruiter).update(status=status)
        # Drop the cached reverse one-to-one so the selector reads the new status.
        self.recruiter = type(self.recruiter).objects.get(pk=self.recruiter.pk)

    def test_approved_case_marks_the_document_step_done(self):
        steps = build_employer_onboarding_steps(self.recruiter)

        self.assertTrue(steps['business_doc_current'])
        self.assertTrue(steps['business_doc_approved'])

    def test_ended_or_reopened_case_requires_new_documents(self):
        for status in (
            EmployerVerificationCase.Status.EXPIRED,
            EmployerVerificationCase.Status.REVOKED,
            EmployerVerificationCase.Status.REJECTED,
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
        ):
            with self.subTest(status=status):
                self._set_case_status(status)

                steps = build_employer_onboarding_steps(self.recruiter)

                self.assertFalse(steps['business_doc_current'])
                self.assertFalse(steps['business_doc_approved'])
                self.assertFalse(steps['representative_verified'])
                # Workspace readiness still sees the earlier submission, so an
                # expired employer keeps read access to their workspace.
                self.assertTrue(steps['business_doc_submitted'])

    def test_expired_case_reaches_the_employer_profile_payload(self):
        self._set_case_status(EmployerVerificationCase.Status.EXPIRED)
        self.client.force_authenticate(self.user)

        onboarding = self.client.get(reverse('employer-me')).data['onboarding']

        self.assertFalse(onboarding['business_doc_current'])
        self.assertFalse(onboarding['business_doc_approved'])
        self.assertTrue(onboarding['business_doc_submitted'])
