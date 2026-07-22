from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.employers.models import Company, RecruiterProfile
from apps.locations.models import Location

from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobCategory,
    JobCategoryAssignment,
    JobLocation,
)
from ..services import (
    close_job,
    duplicate_job,
    employer_job_posting_context,
    publish_job,
    reopen_job,
)


class JobPostingWorkflowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='posting-owner@example.com', password='password', role='employer'
        )
        self.other_user = get_user_model().objects.create_user(
            email='posting-other@example.com', password='password', role='employer'
        )
        self.company = Company.objects.create(company_name='Posting Co', created_by=self.user)
        self.recruiter = RecruiterProfile.objects.create(user=self.user, company=self.company)
        self.category = JobCategory.objects.create(
            name='Backend', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        province = Location.objects.create(
            code='posting-province', level=Location.Level.PROVINCE, name='Hà Nội'
        )
        self.ward = Location.objects.create(
            code='posting-ward',
            level=Location.Level.WARD,
            name='Phường Dịch Vọng',
            parent=province,
        )

    def make_publishable_job(self, *, title='Backend Engineer'):
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title=title,
            description='Xây dựng hệ thống backend có khả năng mở rộng.',
            deadline=timezone.localdate() + timedelta(days=14),
            number_of_vacancies=1,
        )
        JobCategoryAssignment.objects.create(
            job=job,
            category=self.category,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        JobLocation.objects.create(
            job=job,
            location=self.ward,
            address_detail='Tòa nhà ProCV, Cầu Giấy',
        )
        return job

    @patch('apps.jobs.services.posting.recruiter_posting_readiness')
    def test_publish_enters_review_queue_and_records_owner_history(self, readiness):
        readiness.return_value = (self.recruiter, True)
        job = self.make_publishable_job()

        published = publish_job(job, self.user)

        self.assertEqual(published.status, Job.Status.PENDING)
        self.assertIsNotNone(published.submitted_at)
        self.assertIsNone(published.published_at)
        self.assertTrue(published.slug.endswith(published.public_id))
        self.assertEqual(published.status_history.count(), 1)
        self.assertEqual(published.status_history.get().to_status, Job.Status.PENDING)

    @patch('apps.jobs.services.posting.recruiter_posting_readiness')
    def test_only_lifetime_publications_count_towards_the_free_quota(self, readiness):
        readiness.return_value = (self.recruiter, True)
        for index in range(3):
            job = self.make_publishable_job(title=f'Published {index}')
            job.submitted_at = timezone.now()
            job.status = Job.Status.CLOSED
            job.save(update_fields=['submitted_at', 'status'])
        draft = self.make_publishable_job(title='The fourth job')

        context = employer_job_posting_context(self.user)
        self.assertEqual(context['published_jobs_count'], 3)
        self.assertEqual(context['free_publish_remain'], 0)
        self.assertFalse(context['job_postable'])
        with self.assertRaises(ValidationError):
            publish_job(draft, self.user)

    @patch('apps.jobs.services.posting.recruiter_posting_readiness')
    def test_active_job_returns_to_pending_when_its_owner_resubmits_a_revision(self, readiness):
        readiness.return_value = (self.recruiter, True)
        job = self.make_publishable_job()
        job.status = Job.Status.ACTIVE
        job.submitted_at = timezone.now()
        job.published_at = timezone.now()
        job.approved_at = timezone.now()
        job.save(update_fields=['status', 'submitted_at', 'published_at', 'approved_at'])

        revised = publish_job(job, self.user)

        self.assertEqual(revised.status, Job.Status.PENDING)
        self.assertIsNone(revised.published_at)
        self.assertIsNone(revised.approved_at)
        self.assertEqual(revised.status_history.get().from_status, Job.Status.ACTIVE)

    @patch('apps.jobs.services.posting.recruiter_posting_readiness')
    def test_another_recruiter_cannot_publish_or_duplicate_the_job(self, readiness):
        readiness.return_value = (self.recruiter, True)
        job = self.make_publishable_job()

        with self.assertRaises(ValidationError):
            publish_job(job, self.other_user)
        with self.assertRaises(ValidationError):
            duplicate_job(job, self.other_user)

    @patch('apps.jobs.services.posting.recruiter_posting_readiness')
    def test_owner_reopens_a_closed_job_into_the_review_queue(self, readiness):
        readiness.return_value = (self.recruiter, True)
        job = self.make_publishable_job()
        job.status = Job.Status.ACTIVE
        job.published_at = timezone.now()
        job.save(update_fields=['status', 'published_at'])

        closed = close_job(job, self.user)
        self.assertEqual(closed.status, Job.Status.CLOSED)
        reopened_deadline = timezone.localdate() + timedelta(days=21)
        reopened = reopen_job(closed, self.user, reopened_deadline)

        self.assertEqual(reopened.status, Job.Status.PENDING)
        self.assertIsNone(reopened.published_at)
        self.assertIsNone(reopened.approved_at)
        self.assertEqual(
            list(reopened.status_history.values_list('from_status', 'to_status')),
            [
                (Job.Status.CLOSED, Job.Status.PENDING),
                (Job.Status.ACTIVE, Job.Status.CLOSED),
            ],
        )

    def test_duplicate_copies_private_application_contact_and_emails(self):
        job = self.make_publishable_job()
        contact = JobApplicationContact.objects.create(
            job=job,
            recipient_name='Trưởng phòng nhân sự',
            phone='0900000000',
        )
        JobApplicationEmail.objects.create(contact=contact, email='hr@example.com', sort_order=2)
        job.rejected_reason = 'Lý do cũ không được sao chép.'
        job.save(update_fields=['rejected_reason'])

        duplicate = duplicate_job(job, self.user)

        self.assertEqual(duplicate.status, Job.Status.DRAFT)
        self.assertIsNone(duplicate.submitted_at)
        self.assertEqual(duplicate.rejected_reason, '')
        self.assertEqual(duplicate.application_contact.recipient_name, contact.recipient_name)
        self.assertEqual(duplicate.application_contact.phone, contact.phone)
        self.assertEqual(
            list(duplicate.application_contact.emails.values_list('email', 'sort_order')),
            [('hr@example.com', 2)],
        )
