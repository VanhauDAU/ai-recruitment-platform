"""Talent pool: saving, transparency, re-matching and invitations."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.services import issue_tokens
from apps.candidates.models import CandidateNotification
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.services import create_user_cv
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job, JobCategory, JobCategoryAssignment
from apps.jobs.tests.factories import open_visibility_window

from ..models import CandidateBlock, TalentPoolEntry
from ..services import create_application_record, purge_lapsed_talent_pool_entries

Event = CandidateNotification.EventType


class TalentPoolTests(APITestCase):
    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='pool-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.employer = users.create_user(
            email='pool-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Pool Co', created_by=self.employer)
        make_employer_ready(self.employer, company=company, candidate_data=True)
        backend = JobCategory.objects.create(
            name='Backend', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        accounting = JobCategory.objects.create(
            name='Kế toán', category_type=JobCategory.CategoryType.SPECIALIZATION
        )

        def job(title, category):
            created = Job.objects.create(
                posted_by=self.employer,
                company=company,
                title=title,
                description='d',
                status=Job.Status.ACTIVE,
                **open_visibility_window(),
            )
            JobCategoryAssignment.objects.create(
                job=created,
                category=category,
                role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
            )
            return created

        self.old_job = job('Backend Engineer', backend)
        self.new_job = job('Senior Backend Developer', backend)
        self.unrelated_job = job('Kế toán tổng hợp', accounting)
        template, _version = make_published_template('Pool template')
        cv = create_user_cv(actor=self.candidate, title='Pool CV', template=template)
        fill_cv_for_application(cv, self.candidate)
        self.application = create_application_record(
            candidate=self.candidate, job=self.old_job, cv=cv
        )

    def login(self, user):
        tokens = issue_tokens(user, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def save_to_pool(self, **extra):
        self.login(self.employer)
        return self.client.post(
            reverse('recruiter-talent-pool'),
            {
                'application_public_id': self.application.public_id,
                'note': 'Tiềm năng',
                'tags': ['Python', 'python', 'SQL'],
                **extra,
            },
            format='json',
        )

    def test_saving_tells_the_candidate_and_dedupes_tags(self):
        response = self.save_to_pool()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['tags'], ['Python', 'SQL'])
        notice = CandidateNotification.objects.get(event_type=Event.TALENT_POOL_SAVED)
        self.assertEqual(notice.action_path, '/tai-khoan/kho-ung-vien-tiem-nang')
        duplicate = self.save_to_pool()
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.json(), {'detail': 'Ứng viên đã có trong kho của bạn.'})
        row = self.client.get(reverse('recruiter-application-list')).data['results'][0]
        self.assertTrue(row['in_talent_pool'])

    def test_admin_retention_shortens_how_long_a_saved_candidate_is_kept(self):
        from apps.sitecontent.models import SiteSetting

        SiteSetting.objects.update_or_create(
            key='talent_pool_retention_days', defaults={'value': 90}
        )

        self.assertEqual(self.save_to_pool().status_code, 201)

        entry = TalentPoolEntry.objects.get()
        self.assertAlmostEqual(
            (entry.expires_at - timezone.now()).total_seconds(),
            timedelta(days=90).total_seconds(),
            delta=60,
        )

    def test_suggestions_rank_by_the_job_applied_to_and_invites_once(self):
        entry_id = self.save_to_pool().data['public_id']

        related = self.client.get(
            reverse('recruiter-talent-suggestions'), {'job': self.new_job.public_id}
        )
        unrelated = self.client.get(
            reverse('recruiter-talent-suggestions'), {'job': self.unrelated_job.public_id}
        )
        self.assertEqual(len(related.data), 1, related.data)
        self.assertIn('Cùng vị trí chuyên môn', related.data[0]['reasons'])
        self.assertFalse(related.data[0]['already_invited'])
        self.assertEqual(unrelated.data, [])

        invite_url = reverse('recruiter-talent-pool-invite', args=[entry_id])
        payload = {'job_public_id': self.new_job.public_id}
        self.assertEqual(self.client.post(invite_url, payload, format='json').status_code, 204)
        self.assertEqual(self.client.post(invite_url, payload, format='json').status_code, 400)
        invite = CandidateNotification.objects.get(event_type=Event.JOB_INVITATION)
        self.assertEqual(invite.action_path, f'/viec-lam/{self.new_job.slug}')
        again = self.client.get(
            reverse('recruiter-talent-suggestions'), {'job': self.new_job.public_id}
        )
        self.assertTrue(again.data[0]['already_invited'])

    def test_blocked_and_already_applied_people_are_not_suggested(self):
        self.save_to_pool()
        CandidateBlock.objects.create(
            recruiter=self.employer,
            company=self.new_job.company,
            candidate=self.candidate,
            reason='spam',
        )

        response = self.client.get(
            reverse('recruiter-talent-suggestions'), {'job': self.new_job.public_id}
        )

        self.assertEqual(response.data, [])

    def test_candidate_sees_and_withdraws(self):
        self.save_to_pool()
        self.login(self.candidate)

        listing = self.client.get(reverse('candidate-talent-pools'))
        self.assertEqual(listing.data['results'][0]['company_name'], 'Pool Co')
        entry_id = listing.data['results'][0]['public_id']
        withdraw = self.client.post(reverse('candidate-talent-pool-withdraw', args=[entry_id]))

        self.assertEqual(withdraw.status_code, 204)
        self.assertEqual(self.client.get(reverse('candidate-talent-pools')).data['results'], [])
        again = self.client.post(reverse('candidate-talent-pool-withdraw', args=[entry_id]))
        self.assertEqual(again.status_code, 404)
        self.login(self.employer)
        self.assertEqual(self.client.get(reverse('recruiter-talent-pool')).data['results'], [])

    def test_lapsed_entries_are_purged(self):
        self.save_to_pool()
        TalentPoolEntry.objects.update(expires_at=timezone.now() - timedelta(days=1))

        self.assertEqual(purge_lapsed_talent_pool_entries(), 1)
