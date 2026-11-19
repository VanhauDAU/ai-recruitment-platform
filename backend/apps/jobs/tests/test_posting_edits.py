"""Editing job content outside publication: the write form, records, copies and deletion."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.campaigns.models import RecruitmentCampaign
from common.vietnam_time import vietnam_today

from ..api.serializers import EmployerJobWriteSerializer
from ..models import (
    Job,
    JobApplicationContact,
    JobCategoryAssignment,
)
from ..models.querysets import publicly_available_job_filter
from ..services import (
    RESPONSIBILITY_STATEMENT_VERSION,
    create_job_record,
    delete_job_draft,
    duplicate_job,
    update_employer_job,
    update_job_record,
)
from .factories import JobPostingFixture

ACCEPTED = {'accepted_statement_version': RESPONSIBILITY_STATEMENT_VERSION}


class JobEditingTests(JobPostingFixture, TestCase):
    def test_serializer_accepts_the_deadline_and_ignores_internal_visibility(self):
        deadline = vietnam_today() + timedelta(days=20)
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={
                'deadline': deadline.isoformat(),
                'requested_visibility_days': 45,
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = update_job_record(serializer.instance, serializer.validated_data)
        self.assertEqual(job.deadline, deadline)
        self.assertEqual(job.requested_visibility_days, 30)
        self.assertNotIn('requested_visibility_days', serializer.validated_data)

    def test_basic_job_deadline_accepts_the_configured_ninety_day_maximum(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={'deadline': (vietnam_today() + timedelta(days=90)).isoformat()},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_basic_job_deadline_rejects_day_after_the_configured_maximum(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={'deadline': (vietnam_today() + timedelta(days=91)).isoformat()},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('deadline', serializer.errors)

    def test_application_reasons_are_ordered_and_limited_to_three_unique_items(self):
        job = self.make_publishable_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'application_reasons': ['  Sản phẩm có tác động  ', 'Đội ngũ giàu kinh nghiệm']},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        update_job_record(job, serializer.validated_data)
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

    def test_serializer_does_not_expose_visibility_duration_as_an_employer_write(self):
        serializer = EmployerJobWriteSerializer(
            self.make_publishable_job(),
            data={'requested_visibility_days': 91},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('requested_visibility_days', serializer.validated_data)

    def test_updating_an_active_job_takes_effect_without_leaving_public(self):
        job = self.make_active_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'title': 'Backend Engineer — nội dung mới'},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        revised = update_employer_job(job, self.user, serializer.validated_data)

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
        self.assertEqual(job.requested_visibility_days, 90)
        self.assertEqual(job.status, Job.Status.ACTIVE)

    def test_active_edit_rejects_an_out_of_policy_deadline_before_mutating_the_job(self):
        job = self.make_active_job()
        serializer = EmployerJobWriteSerializer(
            job,
            data={'deadline': vietnam_today() + timedelta(days=91)},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('deadline', serializer.errors)
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)

    def test_job_record_create_writes_nested_rows_and_contact(self):
        job = create_job_record(
            {
                'posted_by': self.user,
                'company': self.company,
                'title': 'Data Engineer',
                'description': 'Xây dựng pipeline dữ liệu.',
                'category_assignments': [
                    {
                        'category': self.category,
                        'role': JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
                    }
                ],
                'job_locations': [{'location': self.ward, 'address_detail': 'Cầu Giấy'}],
                'application_contact': {
                    'recipient_name': 'HR',
                    'phone': '0900000001',
                    'emails': [{'email': 'data-hr@example.com'}],
                },
            }
        )

        self.assertEqual(job.category_assignments.get().category, self.category)
        self.assertEqual(job.job_locations.get().address_detail, 'Cầu Giấy')
        self.assertFalse(job.work_schedules.exists())
        self.assertEqual(
            list(job.application_contact.emails.values_list('email', flat=True)),
            ['data-hr@example.com'],
        )

    def test_job_record_update_replaces_only_the_lists_it_is_given(self):
        job = self.make_publishable_job()

        update_job_record(
            job, {'title': 'Backend Lead', 'job_locations': [{'location': self.ward}]}
        )

        job.refresh_from_db()
        self.assertEqual(job.title, 'Backend Lead')
        self.assertEqual(job.job_locations.get().address_detail, '')
        self.assertEqual(job.work_schedules.count(), 1)
        self.assertEqual(job.application_contact.emails.get().email, 'hr@example.com')

        update_job_record(job, {'application_contact': None})
        self.assertFalse(JobApplicationContact.objects.filter(job=job).exists())

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
