from datetime import timedelta
from importlib import import_module
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

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
from ..management.commands.publish_converted_pending_jobs import CONVERSION_NOTE
from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobCategory,
    JobCategoryAssignment,
    JobLocation,
    JobStatusHistory,
    JobWorkSchedule,
)
from ..models.querysets import publicly_available_job_filter
from ..services import (
    RESPONSIBILITY_STATEMENT_VERSION,
    close_job,
    delete_job_draft,
    duplicate_job,
    employer_job_posting_context,
    extend_job_deadline,
    lifecycle_local_date,
    publish_job,
    reopen_job,
    update_employer_job,
)

ACCEPTED = {'accepted_statement_version': RESPONSIBILITY_STATEMENT_VERSION}


class JobPostingWorkflowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='posting-owner@example.com', password='password', role='employer'
        )
        self.other_user = get_user_model().objects.create_user(
            email='posting-other@example.com', password='password', role='employer'
        )
        self.company = Company.objects.create(company_name='Posting Co', created_by=self.user)
        self.recruiter = make_employer_ready(
            self.user,
            company=self.company,
            candidate_data=True,
        )
        # The second recruiter can use the workspace but is not verified yet.
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

    def make_publishable_job(self, *, title='Backend Engineer', owner=None):
        job = Job.objects.create(
            posted_by=owner or self.user,
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
            deadline=lifecycle_local_date() + timedelta(days=14),
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
        job.deadline = deadline or lifecycle_local_date() + timedelta(days=14)
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
            publish_job(job, self.user, **ACCEPTED)

        self.assertIn('requirements', context.exception.detail)

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
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

    @override_settings(JOB_LIFECYCLE_V2_MODE='enforce')
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

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_publishing_an_already_public_job_changes_nothing(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_active_job(published_at=timezone.now() - timedelta(days=3))

        republished = publish_job(job, self.user, **ACCEPTED)

        self.assertEqual(republished.status, Job.Status.ACTIVE)
        self.assertEqual(republished.published_at, job.published_at)
        self.assertFalse(republished.status_history.exists())

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_publish_accepts_ninety_days_and_rejects_day_ninety_one(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        today = lifecycle_local_date()
        accepted = self.make_publishable_job(title='Accepted 90-day deadline')
        accepted.deadline = today + timedelta(days=90)
        accepted.save(update_fields=['deadline'])

        published = publish_job(accepted, self.user, **ACCEPTED)

        self.assertEqual(published.status, Job.Status.ACTIVE)
        self.assertEqual(published.deadline, today + timedelta(days=90))

        rejected = self.make_publishable_job(title='Rejected 91-day deadline')
        rejected.deadline = today + timedelta(days=91)
        rejected.save(update_fields=['deadline'])

        with self.assertRaises(ValidationError) as context:
            publish_job(rejected, self.user, **ACCEPTED)

        self.assertIn('deadline', context.exception.detail)
        rejected.refresh_from_db()
        self.assertEqual(rejected.status, Job.Status.DRAFT)

    def test_deadline_extension_requires_a_strictly_later_deadline(self):
        today = lifecycle_local_date()
        job = self.make_active_job(deadline=today + timedelta(days=10))

        for invalid_deadline in (job.deadline, today + timedelta(days=5)):
            with self.subTest(deadline=invalid_deadline):
                with self.assertRaises(ValidationError):
                    extend_job_deadline(job, self.user, invalid_deadline)

        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=10))
        self.assertEqual(job.status, Job.Status.ACTIVE)

    def test_visibility_extension_uses_immutable_cycle_anchor(self):
        job = self.make_active_job(deadline=lifecycle_local_date() + timedelta(days=35))
        anchor = timezone.now() - timedelta(days=10)
        job.first_approved_at = anchor
        job.visibility_starts_at = anchor
        job.visibility_ends_at = anchor + timedelta(days=30)
        job.requested_visibility_days = 30
        job.save(
            update_fields=[
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
                'requested_visibility_days',
            ]
        )

        extended = extend_job_deadline(
            job,
            self.user,
            job.deadline,
            requested_visibility_days=45,
        )

        self.assertEqual(extended.first_approved_at, anchor)
        self.assertEqual(extended.visibility_starts_at, anchor)
        self.assertEqual(extended.visibility_ends_at, anchor + timedelta(days=45))
        self.assertEqual(extended.requested_visibility_days, 45)

    def test_deadline_extension_cannot_exceed_internal_visibility(self):
        today = lifecycle_local_date()
        job = self.make_active_job(deadline=today + timedelta(days=5))
        anchor = timezone.now()
        job.first_approved_at = anchor
        job.visibility_starts_at = anchor
        job.visibility_ends_at = anchor + timedelta(days=10)
        job.save(
            update_fields=[
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
            ]
        )

        with self.assertRaises(ValidationError) as context:
            extend_job_deadline(job, self.user, today + timedelta(days=11))

        self.assertIn('deadline', context.exception.detail)
        job.refresh_from_db()
        self.assertEqual(job.deadline, today + timedelta(days=5))

    def test_deadline_and_visibility_can_be_extended_atomically(self):
        today = lifecycle_local_date()
        job = self.make_active_job(deadline=today + timedelta(days=5))
        anchor = timezone.now()
        job.first_approved_at = anchor
        job.visibility_starts_at = anchor
        job.visibility_ends_at = anchor + timedelta(days=10)
        job.requested_visibility_days = 10
        job.save(
            update_fields=[
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
                'requested_visibility_days',
            ]
        )

        extended = extend_job_deadline(
            job,
            self.user,
            today + timedelta(days=14),
            requested_visibility_days=14,
        )

        self.assertEqual(extended.deadline, today + timedelta(days=14))
        self.assertEqual(extended.visibility_ends_at, anchor + timedelta(days=14))

    def test_serializer_accepts_application_deadline_and_ignores_internal_visibility(self):
        deadline = lifecycle_local_date() + timedelta(days=20)
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={
                'application_deadline': deadline.isoformat(),
                'requested_visibility_days': 45,
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save()
        self.assertEqual(job.deadline, deadline)
        self.assertEqual(job.requested_visibility_days, 30)
        self.assertNotIn('requested_visibility_days', serializer.validated_data)

    def test_basic_job_deadline_accepts_the_configured_ninety_day_maximum(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={
                'application_deadline': (lifecycle_local_date() + timedelta(days=90)).isoformat()
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_basic_job_deadline_rejects_day_after_the_configured_maximum(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={
                'application_deadline': (lifecycle_local_date() + timedelta(days=91)).isoformat()
            },
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('application_deadline', serializer.errors)

    def test_application_reasons_are_ordered_and_limited_to_three_unique_items(self):
        job = self.make_publishable_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'application_reasons': ['  Sản phẩm có tác động  ', 'Đội ngũ giàu kinh nghiệm']},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        job.refresh_from_db()
        self.assertEqual(
            job.application_reasons,
            ['Sản phẩm có tác động', 'Đội ngũ giàu kinh nghiệm'],
        )

        invalid = EmployerJobWriteSerializer(
            job,
            data={'application_reasons': ['A', 'B', 'C', 'D']},
            partial=True,
        )
        self.assertFalse(invalid.is_valid())
        self.assertIn('application_reasons', invalid.errors)

    def test_serializer_rejects_conflicting_deadline_aliases(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={
                'deadline': (lifecycle_local_date() + timedelta(days=10)).isoformat(),
                'application_deadline': (lifecycle_local_date() + timedelta(days=11)).isoformat(),
            },
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('application_deadline', serializer.errors)

    def test_serializer_does_not_expose_visibility_duration_as_an_employer_write(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={'requested_visibility_days': 91},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('requested_visibility_days', serializer.validated_data)

    def test_deadline_extension_accepts_ninety_day_boundary_and_rejects_later_date(self):
        today = lifecycle_local_date()
        accepted = self.make_active_job(
            deadline=today + timedelta(days=10),
            published_at=timezone.now(),
        )

        extended = extend_job_deadline(accepted, self.user, today + timedelta(days=90))

        self.assertEqual(extended.deadline, today + timedelta(days=90))
        self.assertEqual(extended.status, Job.Status.ACTIVE)

        rejected = self.make_active_job(
            deadline=today + timedelta(days=10),
            published_at=timezone.now(),
        )
        with self.assertRaises(ValidationError):
            extend_job_deadline(rejected, self.user, today + timedelta(days=91))
        rejected.refresh_from_db()
        self.assertEqual(rejected.deadline, today + timedelta(days=10))

    def test_deadline_extension_cannot_exceed_ninety_day_public_lifetime(self):
        today = lifecycle_local_date()
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

    def test_expired_active_job_within_grace_is_renewed_without_leaving_public(self):
        today = lifecycle_local_date()
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
        self.assertEqual(renewed.status, Job.Status.ACTIVE)
        self.assertEqual(renewed.published_at, job.published_at)
        self.assertFalse(renewed.status_history.exists())
        self.assertTrue(
            CampaignActivity.objects.filter(
                campaign=campaign,
                event_type=CampaignActivity.EventType.JOB_UPDATED,
                subject_public_id=job.public_id,
            ).exists()
        )

    def test_expired_active_job_outside_thirty_day_grace_cannot_be_renewed(self):
        today = lifecycle_local_date()
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
        today = lifecycle_local_date()
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

    def test_updating_an_active_job_takes_effect_without_leaving_public(self):
        job = self.make_active_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'title': 'Backend Engineer — nội dung mới'},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        revised = update_employer_job(serializer, self.user)

        self.assertEqual(revised.title, 'Backend Engineer — nội dung mới')
        self.assertEqual(revised.status, Job.Status.ACTIVE)
        self.assertEqual(revised.published_at, job.published_at)
        self.assertEqual(revised.approved_at, job.approved_at)
        self.assertFalse(revised.status_history.exists())
        self.assertTrue(Job.objects.filter(publicly_available_job_filter(), pk=job.pk).exists())

    def test_active_job_visibility_duration_is_ignored_by_the_write_serializer(self):
        job = self.make_active_job()
        job.first_approved_at = job.approved_at
        job.visibility_starts_at = job.approved_at
        job.visibility_ends_at = job.approved_at + timedelta(days=30)
        job.save(update_fields=['first_approved_at', 'visibility_starts_at', 'visibility_ends_at'])
        serializer = EmployerJobWriteSerializer(
            job,
            data={'requested_visibility_days': 45},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('requested_visibility_days', serializer.validated_data)
        self.assertEqual(job.requested_visibility_days, 30)
        self.assertEqual(job.status, Job.Status.ACTIVE)

    def test_active_edit_rejects_an_out_of_policy_deadline_before_mutating_the_job(self):
        job = self.make_active_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'deadline': lifecycle_local_date() + timedelta(days=91)},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('deadline', serializer.errors)
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)

    @patch('apps.jobs.services.posting.recruiter_job_posting_entitlement')
    def test_another_recruiter_cannot_publish_or_duplicate_the_job(self, entitlement):
        entitlement.return_value = (self.recruiter, self.free_entitlement)
        job = self.make_publishable_job()

        with self.assertRaises(ValidationError):
            publish_job(job, self.other_user, **ACCEPTED)
        with self.assertRaises(ValidationError):
            duplicate_job(job, self.other_user)

    def test_owner_reopens_a_closed_job_and_it_is_public_again(self):
        job = self.make_publishable_job()
        job.status = Job.Status.ACTIVE
        job.published_at = timezone.now()
        job.save(update_fields=['status', 'published_at'])

        closed = close_job(job, self.user)
        self.assertEqual(closed.status, Job.Status.CLOSED)
        reopened_deadline = lifecycle_local_date() + timedelta(days=21)
        reopened = reopen_job(closed, self.user, reopened_deadline, **ACCEPTED)

        self.assertEqual(reopened.status, Job.Status.ACTIVE)
        self.assertEqual(reopened.deadline, reopened_deadline)
        self.assertIsNone(reopened.closed_at)
        self.assertIsNotNone(reopened.published_at)
        self.assertEqual(reopened.approved_at, reopened.published_at)
        self.assertEqual(
            list(reopened.status_history.values_list('from_status', 'to_status')),
            [
                (Job.Status.CLOSED, Job.Status.ACTIVE),
                (Job.Status.ACTIVE, Job.Status.CLOSED),
            ],
        )

    def test_reopen_requires_the_commitment_and_records_it_again(self):
        closed = close_job(self.make_active_job(), self.user)
        deadline = lifecycle_local_date() + timedelta(days=21)

        with self.assertRaises(ValidationError) as context:
            reopen_job(closed, self.user, deadline)

        self.assertEqual(str(context.exception.detail['code']), 'JOB_RESPONSIBILITY_REQUIRED')
        closed.refresh_from_db()
        self.assertEqual(closed.status, Job.Status.CLOSED)
        self.assertIsNone(closed.responsibility_accepted_at)

        reopened = reopen_job(closed, self.user, deadline, **ACCEPTED)

        self.assertEqual(reopened.responsibility_accepted_at, reopened.published_at)
        self.assertEqual(
            reopened.responsibility_statement_version,
            RESPONSIBILITY_STATEMENT_VERSION,
        )

    def test_api_refuses_to_make_a_job_public_without_the_commitment(self):
        client = APIClient()
        client.force_authenticate(self.user)
        acknowledgement = {'responsibility_statement_version': RESPONSIBILITY_STATEMENT_VERSION}
        draft = self.make_publishable_job()
        closed = close_job(self.make_active_job(), self.user)
        deadline = (lifecycle_local_date() + timedelta(days=21)).isoformat()
        requests = (
            (reverse('employer-job-submit', kwargs={'public_id': draft.public_id}), {}),
            (
                reverse('employer-job-reopen', kwargs={'public_id': closed.public_id}),
                {'application_deadline': deadline},
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

    def test_reopen_accepts_ninety_days_and_rejects_day_ninety_one(self):
        today = lifecycle_local_date()
        accepted = self.make_active_job()
        accepted = close_job(accepted, self.user)

        reopened = reopen_job(accepted, self.user, today + timedelta(days=90), **ACCEPTED)

        self.assertEqual(reopened.status, Job.Status.ACTIVE)
        self.assertEqual(reopened.deadline, today + timedelta(days=90))

        rejected = self.make_active_job()
        rejected = close_job(rejected, self.user)
        with self.assertRaises(ValidationError) as context:
            reopen_job(rejected, self.user, today + timedelta(days=91), **ACCEPTED)

        self.assertIn('deadline', context.exception.detail)
        rejected.refresh_from_db()
        self.assertEqual(rejected.status, Job.Status.CLOSED)

    @override_settings(JOB_LIFECYCLE_V2_MODE='enforce')
    def test_reopen_cannot_reset_an_expired_visibility_cycle(self):
        job = self.make_active_job()
        job.first_approved_at = timezone.now() - timedelta(days=31)
        job.visibility_starts_at = job.first_approved_at
        job.visibility_ends_at = timezone.now() - timedelta(days=1)
        job.save(update_fields=['first_approved_at', 'visibility_starts_at', 'visibility_ends_at'])
        closed = close_job(job, self.user)

        with self.assertRaises(ValidationError) as context:
            reopen_job(
                closed,
                self.user,
                lifecycle_local_date() + timedelta(days=20),
                **ACCEPTED,
            )

        self.assertEqual(context.exception.detail['code'], 'JOB_VISIBILITY_EXPIRED')
        closed.refresh_from_db()
        self.assertEqual(closed.status, Job.Status.CLOSED)

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
            publish_job(stale_for_publish, self.user, **ACCEPTED)
        with self.assertRaises(ValidationError):
            extend_job_deadline(
                stale_for_extend,
                self.user,
                lifecycle_local_date() + timedelta(days=30),
            )

        stale_for_reopen = Job.objects.get(pk=job.pk)
        reopened = reopen_job(
            Job.objects.get(pk=job.pk),
            self.user,
            lifecycle_local_date() + timedelta(days=21),
            **ACCEPTED,
        )
        with self.assertRaises(ValidationError):
            reopen_job(
                stale_for_reopen,
                self.user,
                lifecycle_local_date() + timedelta(days=28),
                **ACCEPTED,
            )

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)
        self.assertEqual(job.deadline, reopened.deadline)
        self.assertEqual(job.status_history.count(), 2)

    def test_duplicate_copies_private_application_contact_and_emails(self):
        job = self.make_publishable_job()
        contact = job.application_contact
        contact.emails.update(sort_order=2)
        job.approved_snapshot = {'title': 'Nội dung đã đăng không được sao chép.'}
        job.approved_snapshot_at = timezone.now() - timedelta(days=5)
        job.first_approved_at = timezone.now() - timedelta(days=5)
        job.visibility_starts_at = job.first_approved_at
        job.visibility_ends_at = job.visibility_starts_at + timedelta(days=30)
        job.responsibility_accepted_at = job.first_approved_at
        job.responsibility_statement_version = RESPONSIBILITY_STATEMENT_VERSION
        job.save(
            update_fields=[
                'approved_snapshot',
                'approved_snapshot_at',
                'first_approved_at',
                'visibility_starts_at',
                'visibility_ends_at',
                'responsibility_accepted_at',
                'responsibility_statement_version',
            ]
        )

        duplicate = duplicate_job(job, self.user)

        self.assertEqual(duplicate.status, Job.Status.DRAFT)
        self.assertIsNone(duplicate.submitted_at)
        self.assertIsNone(duplicate.first_approved_at)
        self.assertIsNone(duplicate.visibility_starts_at)
        self.assertIsNone(duplicate.visibility_ends_at)
        self.assertEqual(duplicate.approved_snapshot, {})
        self.assertIsNone(duplicate.approved_snapshot_at)
        self.assertIsNone(duplicate.responsibility_accepted_at)
        self.assertEqual(duplicate.responsibility_statement_version, '')
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

    def test_only_a_never_published_draft_can_be_deleted(self):
        fresh_draft = self.make_publishable_job(title='Fresh draft')
        converted_draft = self.make_publishable_job(title='Converted draft')
        converted_draft.submitted_at = timezone.now()
        converted_draft.save(update_fields=['submitted_at'])

        delete_job_draft(fresh_draft, self.user)
        with self.assertRaises(ValidationError):
            delete_job_draft(converted_draft, self.user)

        self.assertFalse(Job.objects.filter(pk=fresh_draft.pk).exists())
        self.assertTrue(Job.objects.filter(pk=converted_draft.pk).exists())

    def make_converted_pending_job(self, *, owner=None):
        job = self.make_publishable_job(owner=owner)
        job.submitted_at = timezone.now()
        job.save(update_fields=['submitted_at'])
        JobStatusHistory.objects.create(
            job=job,
            from_status='pending',
            to_status=Job.Status.DRAFT,
            actor_role=JobStatusHistory.ActorRole.SYSTEM,
            note=CONVERSION_NOTE,
        )
        return job

    def test_converted_pending_jobs_are_republished_only_when_eligible(self):
        eligible = self.make_converted_pending_job()
        blocked = self.make_converted_pending_job(owner=self.other_user)
        untouched_draft = self.make_publishable_job(title='Ordinary draft')
        output = StringIO()

        call_command('publish_converted_pending_jobs', stdout=output)

        eligible.refresh_from_db()
        self.assertEqual(eligible.status, Job.Status.DRAFT)
        self.assertIn('Chạy thử', output.getvalue())

        call_command('publish_converted_pending_jobs', '--apply', stdout=output)

        eligible.refresh_from_db()
        blocked.refresh_from_db()
        untouched_draft.refresh_from_db()
        self.assertEqual(eligible.status, Job.Status.ACTIVE)
        self.assertIsNotNone(eligible.published_at)
        # Sent for approval before the commitment existed: nothing to record.
        self.assertIsNone(eligible.responsibility_accepted_at)
        self.assertEqual(blocked.status, Job.Status.DRAFT)
        self.assertEqual(untouched_draft.status, Job.Status.DRAFT)
        self.assertIn(blocked.public_id, output.getvalue())

    def test_conversion_note_matches_the_data_migration(self):
        migration = import_module('apps.jobs.migrations.0046_convert_job_approval_states')

        self.assertEqual(CONVERSION_NOTE, migration.CONVERSION_NOTE)
