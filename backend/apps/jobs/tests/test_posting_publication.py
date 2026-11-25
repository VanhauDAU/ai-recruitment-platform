"""Publishing a draft: the commitment, the recruiter gates and the lifetime quota."""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.campaigns.models import RecruitmentCampaign
from apps.employers.models import (
    Company,
    CompanyDocument,
    CompanyFollow,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentNeed,
)
from apps.employers.services import recruiter_job_posting_entitlement
from common.vietnam_time import vietnam_today

from ..models import CandidateFollowedCompanyDigestSchedule, Job
from ..models.querysets import publicly_available_job_filter
from ..services import (
    RESPONSIBILITY_STATEMENT_VERSION,
    close_job,
    duplicate_job,
    employer_job_posting_context,
    extend_job_deadline,
    publish_job,
    reopen_job,
)
from .factories import JobPostingFixture

ACCEPTED = {'accepted_statement_version': RESPONSIBILITY_STATEMENT_VERSION}
# The quota reads the entitlement where the posting package looks it up.
ENTITLEMENT = 'apps.jobs.services.posting.quota.recruiter_job_posting_entitlement'


class JobPublicationTests(JobPostingFixture, TestCase):
    @patch(ENTITLEMENT)
    def test_publish_rejects_a_draft_missing_the_complete_manual_form(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()
        job.requirements = ''
        job.save(update_fields=['requirements'])
        job.work_schedules.all().delete()

        with self.assertRaises(ValidationError) as context:
            publish_job(job, self.user, **ACCEPTED)

        self.assertIn('requirements', context.exception.detail)

    @patch(ENTITLEMENT)
    def test_publish_makes_the_job_public_and_records_owner_history(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()

        published = publish_job(job, self.user, **ACCEPTED)

        self.assertEqual(published.status, Job.Status.ACTIVE)
        self.assertIsNotNone(published.submitted_at)
        self.assertEqual(published.published_at, published.approved_at)
        self.assertEqual(published.first_approved_at, published.published_at)
        self.assertEqual(published.visibility_starts_at, published.first_approved_at)
        self.assertEqual(
            published.visibility_ends_at,
            published.visibility_starts_at + timedelta(days=published.requested_visibility_days),
        )
        self.assertEqual(published.approved_snapshot['title'], job.title)
        self.assertEqual(published.approved_snapshot_at, published.published_at)
        self.assertEqual(published.responsibility_accepted_at, published.published_at)
        self.assertEqual(
            published.responsibility_statement_version,
            RESPONSIBILITY_STATEMENT_VERSION,
        )
        self.assertTrue(published.slug.endswith(published.public_id))
        history = published.status_history.get()
        self.assertEqual(history.from_status, Job.Status.DRAFT)
        self.assertEqual(history.to_status, Job.Status.ACTIVE)
        self.assertEqual(history.changed_by, self.user)
        self.assertTrue(Job.objects.filter(publicly_available_job_filter(), pk=job.pk).exists())

    @patch(ENTITLEMENT)
    def test_publish_makes_the_followers_new_job_email_due_now(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        follower = User.objects.create_user(
            email='publish-follower@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        CompanyFollow.objects.create(candidate=follower, company=self.company)

        published = publish_job(self.make_publishable_job(), self.user, **ACCEPTED)

        schedule = CandidateFollowedCompanyDigestSchedule.objects.get(candidate=follower)
        self.assertEqual(schedule.next_run_at, published.published_at)

    def test_publish_requires_the_commitment_currently_in_force(self):
        job = self.make_publishable_job()

        for accepted_version in ('', 'an-outdated-version'):
            with self.subTest(accepted_version=accepted_version):
                with self.assertRaises(ValidationError) as context:
                    publish_job(job, self.user, accepted_statement_version=accepted_version)

                self.assertEqual(
                    str(context.exception.detail['code']),
                    'JOB_RESPONSIBILITY_REQUIRED',
                )
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.DRAFT)
        self.assertIsNone(job.responsibility_accepted_at)
        self.assertEqual(job.responsibility_statement_version, '')
        self.assertFalse(job.status_history.exists())

    def test_publish_is_blocked_until_the_employer_is_verified(self):
        job = self.make_publishable_job(owner=self.other_user)

        with self.assertRaises(ValidationError) as context:
            publish_job(job, self.other_user, **ACCEPTED)

        self.assertEqual(str(context.exception.detail['code']), 'JOB_PUBLICATION_BLOCKED')
        self.assertEqual(
            [str(item['code']) for item in context.exception.detail['blocked_reasons']],
            ['verification_required'],
        )
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.DRAFT)
        self.assertIsNone(job.submitted_at)
        self.assertFalse(job.status_history.exists())

    def test_publish_is_blocked_while_the_campaign_is_not_running(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Paused hiring',
            status=RecruitmentCampaign.Status.PAUSED,
        )
        job = self.make_publishable_job()
        job.campaign = campaign
        job.save(update_fields=['campaign'])

        with self.assertRaises(ValidationError) as context:
            publish_job(job, self.user, **ACCEPTED)

        self.assertEqual(str(context.exception.detail['code']), 'JOB_PUBLICATION_BLOCKED')
        self.assertEqual(
            [str(item['code']) for item in context.exception.detail['blocked_reasons']],
            ['campaign_inactive'],
        )
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.DRAFT)

    def test_publish_cannot_restart_an_expired_visibility_cycle(self):
        job = self.make_publishable_job()
        job.first_approved_at = timezone.now() - timedelta(days=31)
        job.visibility_starts_at = job.first_approved_at
        job.visibility_ends_at = timezone.now() - timedelta(days=1)
        job.save(update_fields=['first_approved_at', 'visibility_starts_at', 'visibility_ends_at'])

        with self.assertRaises(ValidationError) as context:
            publish_job(job, self.user, **ACCEPTED)

        self.assertEqual(context.exception.detail['code'], 'JOB_VISIBILITY_EXPIRED')
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.DRAFT)

    @patch(ENTITLEMENT)
    def test_only_lifetime_publications_count_towards_the_free_quota(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        for index in range(3):
            job = self.make_publishable_job(title=f'Published {index}')
            job.submitted_at = timezone.now()
            job.status = Job.Status.CLOSED
            job.save(update_fields=['submitted_at', 'status'])
        draft = self.make_publishable_job(title='The fourth job')

        context = employer_job_posting_context(self.user)
        self.assertEqual(context['published_jobs_count'], 3)
        self.assertEqual(context['publish_remain'], 0)
        self.assertFalse(context['job_postable'])
        with self.assertRaises(ValidationError) as error:
            publish_job(draft, self.user, **ACCEPTED)

        self.assertIn('Hoàn tất xác thực hồ sơ', str(error.exception.detail))
        self.assertNotIn('được admin duyệt', str(error.exception.detail))

    def test_verified_level_three_account_has_a_100_job_quota(self):
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified'])
        self.company.tax_code = '0101234567'
        self.company.save(update_fields=['tax_code'])
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.verified_phone = '0901234567'
        self.recruiter.contact_phone = self.recruiter.verified_phone
        self.user.phone = self.recruiter.verified_phone
        self.user.save(update_fields=['phone', 'updated_at'])
        self.recruiter.phone_verified_at = timezone.now()
        self.recruiter.registration_completed_at = timezone.now()
        self.recruiter.dpa_accepted_at = timezone.now()
        self.recruiter.save(
            update_fields=[
                'company_role',
                'contact_phone',
                'verified_phone',
                'phone_verified_at',
                'registration_completed_at',
                'dpa_accepted_at',
            ]
        )
        RecruitmentNeed.objects.create(
            recruiter=self.recruiter,
            position_category=self.category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            is_continuous=True,
            headcount=1,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=timezone.now(),
        )
        verification_case = self.recruiter.verification_case
        verification_case.status = EmployerVerificationCase.Status.APPROVED
        verification_case.save(update_fields=['status', 'updated_at'])
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.filter(
                verification_case=verification_case,
                doc_type=doc_type,
            ).update(
                file_url=f'employers/posting/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                mime_type='application/pdf',
                file_size=1024,
                sha256=f'{self.recruiter.pk:064x}',
                status=CompanyDocument.Status.APPROVED,
            )

        for index in range(3):
            prior = self.make_publishable_job(title=f'Free job {index}')
            prior.submitted_at = timezone.now()
            prior.status = Job.Status.CLOSED
            prior.save(update_fields=['submitted_at', 'status'])

        context = employer_job_posting_context(self.user)
        self.assertTrue(context['admin_approved'])
        self.assertEqual(context['account_level'], 3)
        self.assertTrue(context['verified_job_quota_eligible'])
        self.assertEqual(context['publish_limit'], 100)
        self.assertEqual(context['publish_remain'], 97)

        published = publish_job(
            self.make_publishable_job(title='Job after upgrade'),
            self.user,
            **ACCEPTED,
        )
        self.assertEqual(published.status, Job.Status.ACTIVE)

    def test_previous_company_evidence_cannot_unlock_entitlement_or_posting_context(self):
        previous_case = self.recruiter.verification_case
        previous_case.status = EmployerVerificationCase.Status.APPROVED
        previous_case.save(update_fields=['status', 'updated_at'])
        previous_case.documents.update(status=CompanyDocument.Status.APPROVED)
        replacement = Company.objects.create(
            company_name='Replacement Posting Co',
            tax_code='0109998877',
            created_by=self.other_user,
        )
        self.recruiter.company = replacement
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.save(update_fields=['company', 'company_role', 'updated_at'])

        _, entitlement = recruiter_job_posting_entitlement(self.user)
        context = employer_job_posting_context(self.user)

        self.assertFalse(entitlement['verification_completed'])
        self.assertFalse(entitlement['admin_approved'])
        self.assertFalse(entitlement['verified_job_quota_eligible'])
        self.assertFalse(context['job_workspace_ready'])
        self.assertFalse(context['job_postable'])
        self.assertIn(
            'business_document_required',
            [blocker['code'] for blocker in context['blockers']],
        )

    @patch(ENTITLEMENT)
    def test_publishing_an_already_public_job_changes_nothing(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_active_job(published_at=timezone.now() - timedelta(days=3))

        republished = publish_job(job, self.user, **ACCEPTED)

        self.assertEqual(republished.status, Job.Status.ACTIVE)
        self.assertEqual(republished.published_at, job.published_at)
        self.assertFalse(republished.status_history.exists())

    @patch(ENTITLEMENT)
    def test_another_recruiter_cannot_publish_or_duplicate_the_job(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()

        with self.assertRaises(ValidationError):
            publish_job(job, self.other_user, **ACCEPTED)
        with self.assertRaises(ValidationError):
            duplicate_job(job, self.other_user)

    def test_api_refuses_to_make_a_job_public_without_the_commitment(self):
        client = APIClient()
        client.force_authenticate(self.user)
        acknowledgement = {'responsibility_statement_version': RESPONSIBILITY_STATEMENT_VERSION}
        draft = self.make_publishable_job()
        closed = close_job(self.make_active_job(), self.user)
        deadline = (vietnam_today() + timedelta(days=21)).isoformat()
        requests = (
            (reverse('employer-job-submit', kwargs={'public_id': draft.public_id}), {}),
            (
                reverse('employer-job-reopen', kwargs={'public_id': closed.public_id}),
                {'deadline': deadline},
            ),
        )

        for url, payload in requests:
            with self.subTest(url=url):
                refused = client.post(url, payload, format='json')
                accepted = client.post(url, {**payload, **acknowledgement}, format='json')

                self.assertEqual(refused.status_code, 400, refused.data)
                self.assertEqual(str(refused.data['code']), 'JOB_RESPONSIBILITY_REQUIRED')
                self.assertEqual(accepted.status_code, 200, accepted.data)
                self.assertEqual(accepted.data['status'], Job.Status.ACTIVE)

    def test_posting_context_refuses_what_publish_would_refuse(self):
        unverified = employer_job_posting_context(self.other_user)
        verified = employer_job_posting_context(self.user)

        self.assertFalse(unverified['job_postable'])
        self.assertEqual(
            [blocker['code'] for blocker in unverified['publish_blockers']],
            ['verification_required'],
        )
        self.assertEqual(unverified['block_reason'], unverified['publish_blockers'][0]['label'])
        self.assertTrue(verified['job_postable'])
        self.assertEqual(verified['publish_blockers'], [])
        self.assertEqual(verified['verified_publish_limit'], 100)

    @patch(ENTITLEMENT)
    def test_stale_job_instances_cannot_overwrite_a_completed_transition(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()
        job.status = Job.Status.ACTIVE
        job.submitted_at = timezone.now()
        job.save(update_fields=['status', 'submitted_at'])
        stale_for_publish = Job.objects.get(pk=job.pk)
        stale_for_extend = Job.objects.get(pk=job.pk)

        close_job(job, self.user)

        with self.assertRaises(ValidationError):
            publish_job(stale_for_publish, self.user, **ACCEPTED)
        with self.assertRaises(ValidationError):
            extend_job_deadline(
                stale_for_extend,
                self.user,
                vietnam_today() + timedelta(days=30),
            )

        stale_for_reopen = Job.objects.get(pk=job.pk)
        reopened = reopen_job(
            Job.objects.get(pk=job.pk),
            self.user,
            vietnam_today() + timedelta(days=21),
            **ACCEPTED,
        )
        with self.assertRaises(ValidationError):
            reopen_job(
                stale_for_reopen,
                self.user,
                vietnam_today() + timedelta(days=28),
                **ACCEPTED,
            )

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)
        self.assertEqual(job.deadline, reopened.deadline)
        self.assertEqual(job.status_history.count(), 2)
