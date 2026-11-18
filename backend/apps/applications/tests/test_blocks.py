"""Company blocklist and the mass-apply signal."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.services import issue_tokens
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.services import create_user_cv
from apps.employers.models import Company, RecruiterProfile
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

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
        self.cv = create_user_cv(actor=self.candidate, title='Block CV', template=template)
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
            reverse('recruiter-candidate-blocks'),
            {'application_public_id': self.application.public_id, 'reason': 'spam', **payload},
            format='json',
        )

    def apply(self, job):
        self.login(self.candidate)
        return self.client.post(
            reverse('candidate-application-list-create'),
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

    def _colleague_with_job(self):
        colleague = get_user_model().objects.create_user(
            email='block-colleague@example.com', password='password', role='employer'
        )
        make_employer_ready(colleague, company=self.jobs[0].company, candidate_data=True)
        job = Job.objects.create(
            posted_by=colleague,
            company=self.jobs[0].company,
            title='Colleague job',
            description='d',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        return colleague, job

    def test_the_block_stays_with_the_company_when_the_blocker_leaves(self):
        _colleague, colleague_job = self._colleague_with_job()
        self.block()
        RecruiterProfile.objects.filter(user=self.employer).update(company=None)

        refused = self.apply(colleague_job)

        self.assertEqual(refused.status_code, 400, refused.data)

    def test_rejecting_pending_covers_every_job_of_the_company(self):
        _colleague, colleague_job = self._colleague_with_job()
        on_colleague_job = create_application_record(
            candidate=self.candidate, job=colleague_job, cv=self.cv
        )

        self.block(reject_pending=True)

        on_colleague_job.refresh_from_db()
        self.assertEqual(on_colleague_job.status, Status.REJECTED)

    def test_owner_sees_and_lifts_a_colleague_block_but_members_only_their_own(self):
        colleague, _job = self._colleague_with_job()
        # The colleague blocks; the employer created the company and is its owner.
        block = CandidateBlock.objects.create(
            recruiter=colleague,
            company=self.jobs[0].company,
            candidate=self.candidate,
            reason='spam',
        )
        self.login(self.employer)
        listing = self.client.get(reverse('recruiter-candidate-blocks'))
        row = listing.data['results'][0]
        self.assertEqual(row['public_id'], block.public_id)
        self.assertTrue(row['can_lift'])

        lift = self.client.post(reverse('recruiter-candidate-block-lift', args=[block.public_id]))

        self.assertEqual(lift.status_code, 200, lift.data)

    def test_a_member_cannot_lift_a_colleague_block(self):
        colleague, _job = self._colleague_with_job()
        block = CandidateBlock.objects.create(
            recruiter=self.employer,
            company=self.jobs[0].company,
            candidate=self.candidate,
            reason='spam',
        )
        self.login(colleague)

        row = self.client.get(reverse('recruiter-candidate-blocks')).data['results'][0]
        lift = self.client.post(reverse('recruiter-candidate-block-lift', args=[block.public_id]))

        self.assertFalse(row['can_lift'])
        self.assertEqual(lift.status_code, 404)

    def test_block_can_reject_pending_applications_and_be_lifted(self):
        response = self.block(reject_pending=True, duration_days=30)

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Status.REJECTED)
        self.assertIsNotNone(CandidateBlock.objects.get().expires_at)
        listing = self.client.get(reverse('recruiter-candidate-blocks'))
        self.assertEqual(listing.data['results'][0]['candidate_email'], self.candidate.email)

        lift = self.client.post(
            reverse('recruiter-candidate-block-lift', args=[response.data['public_id']])
        )
        self.assertEqual(lift.status_code, 200)
        self.assertEqual(self.apply(self.jobs[1]).status_code, 201)

    def test_double_block_and_foreign_application_are_refused(self):
        self.block()
        again = self.block()
        self.assertEqual(again.status_code, 400)
        self.assertEqual(
            again.json(), {'detail': 'Ứng viên này đã ở trong danh sách chặn của công ty.'}
        )
        self.login(self.outsider)
        response = self.client.post(
            reverse('recruiter-candidate-blocks'),
            {'application_public_id': self.application.public_id, 'reason': 'spam'},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_workspace_flags_mass_applying_and_blocked_candidates(self):
        for job in self.jobs[1:5]:
            create_application_record(candidate=self.candidate, job=job, cv=self.cv)
        self.login(self.employer)

        row = self.client.get(reverse('recruiter-application-list')).data['results'][0]
        self.assertEqual(row['mass_apply_signal'], {'jobs': 5, 'window_days': 14})
        self.assertFalse(row['candidate_blocked'])

        self.block()
        row = self.client.get(reverse('recruiter-application-list')).data['results'][0]
        self.assertTrue(row['candidate_blocked'])
        self.assertIsNone(row['mass_apply_signal'])
