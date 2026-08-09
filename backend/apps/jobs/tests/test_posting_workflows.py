from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.employers.models import (
    CampaignActivity,
    Company,
    CompanyDocument,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentCampaign,
    RecruitmentNeed,
)
from apps.employers.services import recruiter_job_posting_entitlement
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.locations.models import Location

from ..api.serializers import EmployerJobWriteSerializer
from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobCategory,
    JobCategoryAssignment,
    JobLocation,
    JobWorkSchedule,
)
from ..services import (
    close_job,
    duplicate_job,
    employer_job_posting_context,
    extend_job_deadline,
    publish_job,
    reopen_job,
    update_employer_job,
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
        self.recruiter = make_employer_ready(self.user, company=self.company)
        make_employer_ready(self.other_user, company=self.company)
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
        self.free_entitlement = {
            'verification_completed': False,
            'admin_approved': False,
            'account_level': 0,
            'verified_job_quota_eligible': False,
        }

    def make_publishable_job(self, *, title='Backend Engineer'):
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title=title,
            description='Xây dựng hệ thống backend có khả năng mở rộng.',
            requirements='Có kinh nghiệm phát triển API và làm việc nhóm.',
            benefits='Lương thưởng cạnh tranh và bảo hiểm đầy đủ.',
            work_type=Job.WorkType.ONSITE,
            employment_type=Job.EmploymentType.FULL_TIME,
            education_level=Job.EducationLevel.UNIVERSITY,
            experience_years=Job.ExperienceYears.TWO,
            position_level=Job.PositionLevel.EMPLOYEE,
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
        JobWorkSchedule.objects.create(
            job=job,
            weekday_from=1,
            weekday_to=5,
            start_time='08:00:00',
            end_time='17:00:00',
        )
        contact = JobApplicationContact.objects.create(
            job=job,
            recipient_name='Trưởng phòng nhân sự',
            phone='0900000000',
        )
        JobApplicationEmail.objects.create(contact=contact, email='hr@example.com')
        return job

    def make_active_job(self, *, deadline=None, published_at=None, campaign=None):
        published_at = published_at or timezone.now()
        job = self.make_publishable_job()
        job.campaign = campaign
        job.status = Job.Status.ACTIVE
        job.deadline = deadline or timezone.localdate() + timedelta(days=14)
        job.submitted_at = published_at
        job.published_at = published_at
        job.approved_at = published_at
        job.save(
            update_fields=[
                'campaign',
                'status',
                'deadline',
                'submitted_at',
                'published_at',
                'approved_at',
            ]
        )
        return job

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_publish_rejects_a_draft_missing_the_complete_manual_form(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()
        job.requirements = ''
        job.save(update_fields=['requirements'])
        job.work_schedules.all().delete()

        with self.assertRaises(ValidationError) as context:
            publish_job(job, self.user)

        self.assertIn('requirements', context.exception.detail)

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_publish_enters_review_queue_and_records_owner_history(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()

        published = publish_job(job, self.user)

        self.assertEqual(published.status, Job.Status.PENDING)
        self.assertIsNotNone(published.submitted_at)
        self.assertIsNone(published.published_at)
        self.assertTrue(published.slug.endswith(published.public_id))
        self.assertEqual(published.status_history.count(), 1)
        self.assertEqual(published.status_history.get().to_status, Job.Status.PENDING)

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
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
        self.assertEqual(context['free_publish_remain'], 0)
        self.assertFalse(context['job_postable'])
        with self.assertRaises(ValidationError) as error:
            publish_job(draft, self.user)

        self.assertIn('Hoàn tất xác thực hồ sơ', str(error.exception.detail))
        self.assertNotIn('được admin duyệt', str(error.exception.detail))

    def test_verified_level_three_account_has_a_100_job_quota(self):
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified'])
        self.company.tax_code = '0101234567'
        self.company.save(update_fields=['tax_code'])
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.verified_phone = '0901234567'
        self.recruiter.phone_verified_at = timezone.now()
        self.recruiter.registration_completed_at = timezone.now()
        self.recruiter.dpa_accepted_at = timezone.now()
        self.recruiter.save(
            update_fields=[
                'company_role',
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

        published = publish_job(self.make_publishable_job(title='Job after upgrade'), self.user)
        self.assertEqual(published.status, Job.Status.PENDING)

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

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_active_job_returns_to_pending_when_its_owner_resubmits_a_revision(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
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

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_publish_rejects_a_deadline_more_than_thirty_days_away(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()
        job.deadline = timezone.localdate() + timedelta(days=31)
        job.save(update_fields=['deadline'])

        with self.assertRaises(ValidationError) as context:
            publish_job(job, self.user)

        self.assertIn('deadline', context.exception.detail)
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.DRAFT)

    def test_deadline_extension_requires_a_strictly_later_deadline(self):
        today = timezone.localdate()
        job = self.make_active_job(deadline=today + timedelta(days=10))

        for invalid_deadline in (job.deadline, today + timedelta(days=5)):
            with self.subTest(deadline=invalid_deadline):
                with self.assertRaises(ValidationError):
                    extend_job_deadline(job, self.user, invalid_deadline)

        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=10))
        self.assertEqual(job.status, Job.Status.ACTIVE)

    def test_deadline_extension_accepts_thirty_day_boundary_and_rejects_later_date(self):
        today = timezone.localdate()
        accepted = self.make_active_job(
            deadline=today + timedelta(days=10),
            published_at=timezone.now() - timedelta(days=10),
        )

        extended = extend_job_deadline(accepted, self.user, today + timedelta(days=30))

        self.assertEqual(extended.deadline, today + timedelta(days=30))
        self.assertEqual(extended.status, Job.Status.ACTIVE)

        rejected = self.make_active_job(
            deadline=today + timedelta(days=10),
            published_at=timezone.now() - timedelta(days=10),
        )
        with self.assertRaises(ValidationError):
            extend_job_deadline(rejected, self.user, today + timedelta(days=31))
        rejected.refresh_from_db()
        self.assertEqual(rejected.deadline, today + timedelta(days=10))

    def test_deadline_extension_cannot_exceed_ninety_day_public_lifetime(self):
        today = timezone.localdate()
        boundary = self.make_active_job(
            deadline=today + timedelta(days=5),
            published_at=timezone.now() - timedelta(days=60),
        )

        extended = extend_job_deadline(boundary, self.user, today + timedelta(days=30))

        self.assertEqual(extended.deadline, today + timedelta(days=30))

        over_lifetime = self.make_active_job(
            deadline=today + timedelta(days=5),
            published_at=timezone.now() - timedelta(days=61),
        )
        with self.assertRaises(ValidationError):
            extend_job_deadline(over_lifetime, self.user, today + timedelta(days=30))
        over_lifetime.refresh_from_db()
        self.assertEqual(over_lifetime.deadline, today + timedelta(days=5))

    def test_expired_active_job_within_grace_returns_to_review_queue_with_audit(self):
        today = timezone.localdate()
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Backend hiring',
            status=RecruitmentCampaign.Status.ACTIVE,
            start_date=today - timedelta(days=60),
            target_date=today + timedelta(days=60),
        )
        job = self.make_active_job(
            deadline=today - timedelta(days=30),
            published_at=timezone.now() - timedelta(days=60),
            campaign=campaign,
        )

        renewed = extend_job_deadline(job, self.user, today + timedelta(days=30))

        self.assertEqual(renewed.deadline, today + timedelta(days=30))
        self.assertEqual(renewed.status, Job.Status.PENDING)
        self.assertIsNone(renewed.published_at)
        self.assertIsNone(renewed.approved_at)
        history = renewed.status_history.get()
        self.assertEqual(history.from_status, Job.Status.ACTIVE)
        self.assertEqual(history.to_status, Job.Status.PENDING)
        self.assertEqual(history.changed_by, self.user)
        self.assertIn('gia hạn', history.note.lower())
        self.assertTrue(
            CampaignActivity.objects.filter(
                campaign=campaign,
                event_type=CampaignActivity.EventType.JOB_STATUS_CHANGED,
                subject_public_id=job.public_id,
            ).exists()
        )

    def test_expired_active_job_outside_thirty_day_grace_cannot_be_renewed(self):
        today = timezone.localdate()
        job = self.make_active_job(
            deadline=today - timedelta(days=31),
            published_at=timezone.now() - timedelta(days=61),
        )

        with self.assertRaises(ValidationError):
            extend_job_deadline(job, self.user, today + timedelta(days=29))

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)
        self.assertEqual(job.deadline, today - timedelta(days=31))
        self.assertIsNotNone(job.published_at)
        self.assertFalse(job.status_history.exists())

    def test_campaign_target_caps_extension_and_inactive_campaign_rejects_it(self):
        today = timezone.localdate()
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Time-boxed hiring',
            status=RecruitmentCampaign.Status.ACTIVE,
            start_date=today,
            target_date=today + timedelta(days=20),
        )
        job = self.make_active_job(
            deadline=today + timedelta(days=5),
            campaign=campaign,
        )

        with self.assertRaises(ValidationError):
            extend_job_deadline(job, self.user, today + timedelta(days=21))

        campaign.status = RecruitmentCampaign.Status.PAUSED
        campaign.save(update_fields=['status'])
        with self.assertRaises(ValidationError):
            extend_job_deadline(job, self.user, today + timedelta(days=15))

        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=5))

    def test_updating_an_active_job_moves_the_public_revision_to_pending(self):
        job = self.make_active_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'title': 'Backend Engineer — nội dung mới'},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        revised = update_employer_job(serializer, self.user)

        self.assertEqual(revised.title, 'Backend Engineer — nội dung mới')
        self.assertEqual(revised.status, Job.Status.PENDING)
        self.assertIsNone(revised.published_at)
        self.assertIsNone(revised.approved_at)
        history = revised.status_history.get()
        self.assertEqual(history.from_status, Job.Status.ACTIVE)
        self.assertEqual(history.to_status, Job.Status.PENDING)
        self.assertEqual(history.changed_by, self.user)

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_another_recruiter_cannot_publish_or_duplicate_the_job(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()

        with self.assertRaises(ValidationError):
            publish_job(job, self.other_user)
        with self.assertRaises(ValidationError):
            duplicate_job(job, self.other_user)

    def test_owner_reopens_a_closed_job_into_the_review_queue(self):
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

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
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
            publish_job(stale_for_publish, self.user)
        with self.assertRaises(ValidationError):
            extend_job_deadline(
                stale_for_extend,
                self.user,
                timezone.localdate() + timedelta(days=30),
            )

        stale_for_reopen = Job.objects.get(pk=job.pk)
        reopened = reopen_job(
            Job.objects.get(pk=job.pk),
            self.user,
            timezone.localdate() + timedelta(days=21),
        )
        with self.assertRaises(ValidationError):
            reopen_job(
                stale_for_reopen,
                self.user,
                timezone.localdate() + timedelta(days=28),
            )

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.PENDING)
        self.assertEqual(job.deadline, reopened.deadline)
        self.assertEqual(job.status_history.count(), 2)

    def test_duplicate_copies_private_application_contact_and_emails(self):
        job = self.make_publishable_job()
        contact = job.application_contact
        contact.emails.update(sort_order=2)
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

    def test_duplicate_rejects_job_or_campaign_holds_without_clearing_evidence(self):
        job = self.make_publishable_job()
        job.policy_hold = Job.PolicyHold.TEMPORARY_LOCK
        job.save(update_fields=['policy_hold', 'updated_at'])

        with self.assertRaises(ValidationError) as job_hold:
            duplicate_job(job, self.user)
        self.assertEqual(str(job_hold.exception.detail['code']), 'RECRUITMENT_HOLD_ACTIVE')

        job.policy_hold = Job.PolicyHold.NONE
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Held campaign',
            policy_hold=RecruitmentCampaign.PolicyHold.TEMPORARY_LOCK,
        )
        job.campaign = campaign
        job.save(update_fields=['campaign', 'policy_hold', 'updated_at'])

        with self.assertRaises(ValidationError) as campaign_hold:
            duplicate_job(job, self.user)
        self.assertEqual(
            str(campaign_hold.exception.detail['code']),
            'RECRUITMENT_HOLD_ACTIVE',
        )
        self.assertFalse(Job.objects.filter(title=f'{job.title} (bản sao)').exists())
