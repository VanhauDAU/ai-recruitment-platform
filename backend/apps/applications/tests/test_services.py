from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.cvs.models import CvVersion, UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company, RecruitmentCampaign
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job

from ..api.serializers.employer import ApplicationStatusUpdateSerializer
from ..models import Application, ApplicationStatusHistory
from ..services import (
    InvalidApplicationStatusTransition,
    RecruitmentResourceChanged,
    create_application,
    mark_application_viewed,
    update_application_status,
)
from ..services.automatic_rejection import process_automatic_application_rejections


def create_status_application(suffix):
    candidate = get_user_model().objects.create_user(
        email=f'status-candidate-{suffix}@example.com',
        password='password',
        role='candidate',
    )
    employer = get_user_model().objects.create_user(
        email=f'status-employer-{suffix}@example.com',
        password='password',
        role='employer',
    )
    company = Company.objects.create(
        company_name=f'Status Transition Company {suffix}',
        created_by=employer,
    )
    make_employer_ready(employer, company=company, candidate_data=True)
    job = Job.objects.create(
        posted_by=employer,
        company=company,
        title=f'Status Transition Job {suffix}',
        description='Exercise canonical application status transitions.',
    )
    cv = UserCv.objects.create(
        user=candidate,
        cv_type=UserCv.CvType.BUILDER,
        source=UserCv.Source.BUILDER,
        title=f'Status Transition CV {suffix}',
    )
    version = CvVersion.objects.create(
        cv=cv,
        version_number=1,
        content_hash='0' * 64,
        created_by=candidate,
    )
    application = Application.objects.create(
        candidate=candidate,
        job=job,
        cv=cv,
        submitted_cv_version=version,
        submitted_cv_title=cv.title,
        submitted_cv_source=cv.source,
    )
    return candidate, employer, application


class ApplicationStatusTransitionServiceTests(TestCase):
    def setUp(self):
        self.candidate, self.employer, self.application = create_status_application('service')

    def serializer(self, **data):
        serializer = ApplicationStatusUpdateSerializer(
            Application.objects.get(pk=self.application.pk),
            data=data,
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer

    def test_allows_forward_transition_and_records_matching_timestamp(self):
        serializer = self.serializer(status=Application.Status.SHORTLISTED)

        application = update_application_status(serializer, changed_by=self.employer)

        self.assertEqual(application.status, Application.Status.SHORTLISTED)
        self.assertIsNotNone(application.shortlisted_at)
        history = application.status_history.get()
        self.assertEqual(history.from_status, Application.Status.SUBMITTED)
        self.assertEqual(history.to_status, Application.Status.SHORTLISTED)
        self.assertEqual(history.changed_by, self.employer)

    def test_rejects_backward_or_reopened_transition(self):
        Application.objects.filter(pk=self.application.pk).update(
            status=Application.Status.ACCEPTED,
            accepted_at=timezone.now(),
        )
        serializer = self.serializer(status=Application.Status.VIEWED)

        with self.assertRaises(InvalidApplicationStatusTransition):
            update_application_status(serializer, changed_by=self.employer)

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.ACCEPTED)
        self.assertFalse(self.application.status_history.exists())

    def test_restricted_candidate_can_only_be_rejected(self):
        self.candidate.status = get_user_model().Status.INACTIVE
        self.candidate.is_active = False
        self.candidate.save(update_fields=['status', 'is_active', 'updated_at'])

        with self.assertRaises(InvalidApplicationStatusTransition):
            update_application_status(
                self.serializer(status=Application.Status.SHORTLISTED),
                changed_by=self.employer,
            )

        rejected = update_application_status(
            self.serializer(status=Application.Status.REJECTED),
            changed_by=self.employer,
        )
        self.assertEqual(rejected.status, Application.Status.REJECTED)

    def test_note_only_and_idempotent_status_updates_do_not_reset_timestamp(self):
        original_viewed_at = timezone.now()
        for payload in (
            {'employer_note': 'Internal note'},
            {'status': Application.Status.VIEWED, 'employer_note': 'Updated note'},
        ):
            with self.subTest(payload=payload):
                Application.objects.filter(pk=self.application.pk).update(
                    status=Application.Status.VIEWED,
                    viewed_at=original_viewed_at,
                )
                serializer = self.serializer(**payload)

                application = update_application_status(serializer, changed_by=self.employer)

                self.assertEqual(application.viewed_at, original_viewed_at)
                self.assertFalse(application.status_history.exists())

    def test_stale_serializer_cannot_override_a_completed_terminal_transition(self):
        stale_application = Application.objects.get(pk=self.application.pk)
        winner = self.serializer(status=Application.Status.ACCEPTED)
        stale_loser = ApplicationStatusUpdateSerializer(
            stale_application,
            data={'status': Application.Status.REJECTED},
            partial=True,
        )
        self.assertTrue(stale_loser.is_valid(), stale_loser.errors)

        update_application_status(winner, changed_by=self.employer)
        with self.assertRaises(InvalidApplicationStatusTransition):
            update_application_status(stale_loser, changed_by=self.employer)

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.ACCEPTED)
        self.assertIsNotNone(self.application.accepted_at)
        self.assertIsNone(self.application.rejected_at)
        self.assertEqual(self.application.status_history.count(), 1)

    def test_mark_viewed_rechecks_a_stale_application_before_mutating(self):
        stale_application = Application.objects.get(pk=self.application.pk)
        winner = self.serializer(status=Application.Status.ACCEPTED)
        update_application_status(winner, changed_by=self.employer)

        application = mark_application_viewed(
            stale_application,
            changed_by=self.employer,
        )

        self.assertEqual(application.status, Application.Status.ACCEPTED)
        self.assertIsNone(application.viewed_at)
        self.assertEqual(application.status_history.count(), 1)

    def test_campaign_change_between_scope_read_and_job_lock_fails_closed(self):
        recruiter = self.employer.recruiter_profile
        previous_campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=recruiter.company,
            name='Previous campaign',
        )
        replacement_campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=recruiter.company,
            name='Replacement campaign',
        )
        self.application.job.campaign = replacement_campaign
        self.application.job.save(update_fields=['campaign', 'updated_at'])
        stale_relation = Mock()
        stale_relation.values.return_value.get.return_value = {
            'job_id': self.application.job_id,
            'job__campaign_id': previous_campaign.pk,
        }

        with (
            patch(
                'apps.applications.services.applications.Application.objects.filter',
                return_value=stale_relation,
            ),
            self.assertRaises(RecruitmentResourceChanged),
        ):
            update_application_status(
                self.serializer(status=Application.Status.SHORTLISTED),
                changed_by=self.employer,
            )

    def test_auto_rejection_can_be_reopened_during_email_grace_period(self):
        rejected_at = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            status=Application.Status.REJECTED,
            rejected_at=rejected_at,
            auto_rejected_at=rejected_at,
            status_updated_at=rejected_at,
        )

        application = update_application_status(
            self.serializer(status=Application.Status.SHORTLISTED),
            changed_by=self.employer,
        )

        self.assertEqual(application.status, Application.Status.SHORTLISTED)
        self.assertIsNone(application.auto_rejected_at)
        self.assertIsNone(application.rejected_at)


class AutomaticApplicationRejectionTests(TestCase):
    def setUp(self):
        self.candidate, self.employer, self.application = create_status_application('automatic')
        self.application.job.auto_reject_stale_applications = True
        self.application.job.auto_reject_after_days = 21
        self.application.job.auto_rejection_email_body = (
            'Cảm ơn bạn đã ứng tuyển {job_title} tại {company_name}. '
            'Thời hạn là {auto_reject_weeks} tuần.'
        )
        self.application.job.save(
            update_fields=[
                'auto_reject_stale_applications',
                'auto_reject_after_days',
                'auto_rejection_email_body',
                'updated_at',
            ]
        )

    def test_reminds_recruiter_rejects_stale_application_and_delays_candidate_email(self):
        baseline = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            status_updated_at=baseline - timedelta(days=18),
        )

        reminder_result = process_automatic_application_rejections(now=baseline)
        rejection_result = process_automatic_application_rejections(
            now=baseline + timedelta(days=3)
        )
        before_grace_result = process_automatic_application_rejections(
            now=baseline + timedelta(days=5)
        )
        after_grace_result = process_automatic_application_rejections(
            now=baseline + timedelta(days=6)
        )

        self.assertEqual(reminder_result, {'reminded': 1, 'rejected': 0, 'notified': 0})
        self.assertEqual(rejection_result['rejected'], 1)
        self.assertEqual(before_grace_result['notified'], 0)
        self.assertEqual(after_grace_result['notified'], 1)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.REJECTED)
        self.assertIsNotNone(self.application.auto_rejected_at)
        self.assertIsNotNone(self.application.auto_rejection_email_sent_at)
        self.assertTrue(
            self.application.status_history.filter(
                from_status=Application.Status.SUBMITTED,
                to_status=Application.Status.REJECTED,
            ).exists()
        )
        self.assertEqual(len(self.mailbox), 2)

    @property
    def mailbox(self):
        from django.core import mail

        return mail.outbox

    def test_disabled_job_is_never_processed(self):
        self.application.job.auto_reject_stale_applications = False
        self.application.job.save(update_fields=['auto_reject_stale_applications', 'updated_at'])
        Application.objects.filter(pk=self.application.pk).update(
            status_updated_at=timezone.now() - timedelta(days=60),
        )

        result = process_automatic_application_rejections()

        self.assertEqual(result, {'reminded': 0, 'rejected': 0, 'notified': 0})
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.SUBMITTED)


class ApplicationStatusTransitionConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.candidate, self.employer, self.application = create_status_application('concurrency')

    def test_simultaneous_terminal_transitions_record_exactly_one_winner(self):
        gate = Barrier(2)

        def transition_once(next_status):
            close_old_connections()
            try:
                stale_application = Application.objects.get(pk=self.application.pk)
                serializer = ApplicationStatusUpdateSerializer(
                    stale_application,
                    data={'status': next_status},
                    partial=True,
                )
                if not serializer.is_valid():
                    return 'invalid-payload'
                gate.wait(timeout=5)
                try:
                    update_application_status(serializer, changed_by=self.employer)
                except InvalidApplicationStatusTransition:
                    return 'stale-transition'
                return next_status
            finally:
                close_old_connections()

        terminal_statuses = [
            Application.Status.ACCEPTED,
            Application.Status.REJECTED,
        ]
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(transition_once, terminal_statuses))

        self.assertEqual(outcomes.count('stale-transition'), 1)
        winner = next(outcome for outcome in outcomes if outcome != 'stale-transition')
        self.assertIn(winner, terminal_statuses)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, winner)
        history = self.application.status_history.get()
        self.assertEqual(history.from_status, Application.Status.SUBMITTED)
        self.assertEqual(history.to_status, winner)


class ApplicationSnapshotServiceTests(TestCase):
    def test_create_application_uses_a_new_immutable_snapshot(self):
        candidate = get_user_model().objects.create_user(
            email='application-snapshot@example.com',
            password='password',
            role='candidate',
        )
        cv = UserCv.objects.create(
            user=candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='Applied CV',
        )
        initial = create_initial_document(cv, candidate)
        employer = get_user_model().objects.create_user(
            email='application-employer@example.com',
            password='password',
            role='employer',
        )
        company = Company.objects.create(company_name='Application Company', created_by=employer)
        job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Application Job',
            description='A role used to test the legacy application adapter.',
        )
        serializer = Mock()
        serializer.validated_data = {'cv': cv}

        def save(**kwargs):
            return Application.objects.create(job=job, cv=cv, **kwargs)

        serializer.save.side_effect = save

        application = create_application(serializer, candidate)

        snapshot = CvVersion.objects.get(version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT)
        self.assertEqual(snapshot.parent_version_id, initial.id)
        self.assertEqual(serializer.save.call_args.kwargs['submitted_cv_version'], snapshot)
        self.assertEqual(serializer.save.call_args.kwargs['submitted_cv_title'], 'Applied CV')
        self.assertTrue(
            ApplicationStatusHistory.objects.filter(
                application=application,
                from_status='',
                to_status=Application.Status.SUBMITTED,
            ).exists()
        )
        job.refresh_from_db()
        self.assertEqual(job.application_count, 1)
