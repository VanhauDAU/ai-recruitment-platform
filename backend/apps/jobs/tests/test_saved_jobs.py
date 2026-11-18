from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready

from ..models import Job, SavedJob
from ..services import save_job_for_candidate
from .helpers import open_visibility_window


class SavedJobTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(
            email='saved-jobs-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        employer = User.objects.create_user(
            email='saved-jobs-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(company_name='Saved Jobs Co', created_by=employer)
        make_employer_ready(employer, company=company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Backend Engineer',
            description='Description',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        self.draft = Job.objects.create(
            posted_by=employer, company=company, title='Draft', description='Description'
        )

    def test_saving_twice_keeps_one_row(self):
        first = save_job_for_candidate(candidate=self.candidate, job=self.job)
        second = save_job_for_candidate(candidate=self.candidate, job=self.job)

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(SavedJob.objects.filter(candidate=self.candidate).count(), 1)

    def test_api_saves_a_public_job_and_refuses_a_draft(self):
        self.client.force_authenticate(self.candidate)
        url = reverse('saved-job-list-create')

        saved = self.client.post(url, {'job': self.job.public_id}, format='json')
        again = self.client.post(url, {'job': self.job.public_id}, format='json')
        draft = self.client.post(url, {'job': self.draft.public_id}, format='json')

        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['job_detail']['public_id'], self.job.public_id)
        self.assertEqual(again.status_code, 201, again.data)
        self.assertEqual(draft.status_code, 400)
        listed = self.client.get(url)
        self.assertEqual(
            [item['job_detail']['public_id'] for item in listed.data], [self.job.public_id]
        )
