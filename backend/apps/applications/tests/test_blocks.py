"""Recruiter blocklist and the mass-apply signal."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.services.tokens import issue_tokens
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.services import create_v2_cv
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.helpers import open_visibility_window

from ..models import Application, CandidateBlock
from ..services import create_application_record

Status = Application.Status


class CandidateBlockTests(APITestCase):
    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='block-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.employer = users.create_user(
            email='block-employer@example.com', password='password', role='employer'
        )
        self.outsider = users.create_user(
            email='block-outsider@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Block Co', created_by=self.employer)
        make_employer_ready(self.employer, company=company, candidate_data=True)
        other = Company.objects.create(company_name='Other Block Co', created_by=self.outsider)
        make_employer_ready(self.outsider, company=other, candidate_data=True)
        self.jobs = [
            Job.objects.create(
                posted_by=self.employer,
                company=company,
                title=f'Job {index}',
                description='d',
                status=Job.Status.ACTIVE,
                **open_visibility_window(),
            )
            for index in range(6)
        ]
        self.other_job = Job.objects.create(
            posted_by=self.outsider,
            company=other,
            title='Other',
            description='d',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        template, _version = make_published_template('Block template')
        self.cv = create_v2_cv(actor=self.candidate, title='Block CV', template=template)
        fill_cv_for_application(self.cv, self.candidate)
        self.application = create_application_record(
            candidate=self.candidate, job=self.jobs[0], cv=self.cv
        )

    def login(self, user):
        tokens = issue_tokens(user, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def block(self, **payload):
        self.login(self.employer)
        return self.client.post(
            reverse('recruiter-candidate-blocks-v2'),
            {'application_public_id': self.application.public_id, 'reason': 'spam', **payload},
            format='json',
        )

    def apply(self, job):
        self.login(self.candidate)
        return self.client.post(
            reverse('candidate-application-list-create-v2'),
            {
                'job_public_id': job.public_id,
                'cv_public_id': self.cv.public_id,
                'version_public_id': self.cv.latest_version.public_id,
                'data_processing_consent': True,
            },
            format='json',
        )

    def test_blocked_candidate_gets_a_neutral_refusal_for_this_recruiter_only(self):
        self.assertEqual(self.block().status_code, 201)

        refused = self.apply(self.jobs[1])
        allowed = self.apply(self.other_job)

        self.assertEqual(refused.status_code, 400)
        self.assertNotIn('chặn', str(refused.data).lower())
        self.assertEqual(allowed.status_code, 201, allowed.data)

    def test_a_block_covers_the_jobs_of_colleagues_at_the_same_company(self):
        colleague = get_user_model().objects.create_user(
            email='block-colleague@example.com', password='password', role='employer'
        )
        make_employer_ready(colleague, company=self.jobs[0].company, candidate_data=True)
        colleague_job = Job.objects.create(
            posted_by=colleague,
            company=self.jobs[0].company,
            title='Colleague job',
            description='d',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        self.block()

        refused = self.apply(colleague_job)

        self.assertEqual(refused.status_code, 400, refused.data)
        self.assertNotIn('chặn', str(refused.data).lower())

    def test_block_can_reject_pending_applications_and_be_lifted(self):
        response = self.block(reject_pending=True, duration_days=30)

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Status.REJECTED)
        self.assertIsNotNone(CandidateBlock.objects.get().expires_at)
        listing = self.client.get(reverse('recruiter-candidate-blocks-v2'))
        self.assertEqual(listing.data['results'][0]['candidate_email'], self.candidate.email)

        lift = self.client.post(
            reverse('recruiter-candidate-block-lift-v2', args=[response.data['public_id']])
        )
        self.assertEqual(lift.status_code, 200)
        self.assertEqual(self.apply(self.jobs[1]).status_code, 201)

    def test_double_block_and_foreign_application_are_refused(self):
        self.block()
        self.assertEqual(self.block().status_code, 400)
        self.login(self.outsider)
        response = self.client.post(
            reverse('recruiter-candidate-blocks-v2'),
            {'application_public_id': self.application.public_id, 'reason': 'spam'},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_workspace_flags_mass_applying_and_blocked_candidates(self):
        for job in self.jobs[1:5]:
            create_application_record(candidate=self.candidate, job=job, cv=self.cv)
        self.login(self.employer)

        row = self.client.get(reverse('recruiter-application-list-v2')).data['results'][0]
        self.assertEqual(row['mass_apply_signal'], {'jobs': 5, 'window_days': 14})
        self.assertFalse(row['candidate_blocked'])

        self.block()
        row = self.client.get(reverse('recruiter-application-list-v2')).data['results'][0]
        self.assertTrue(row['candidate_blocked'])
        self.assertIsNone(row['mass_apply_signal'])
