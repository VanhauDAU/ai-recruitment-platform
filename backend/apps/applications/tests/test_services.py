from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from apps.campaigns.models import RecruitmentCampaign
from apps.candidates.models import CandidateNotification
from apps.candidates.services import release_due_candidate_notifications
from apps.cvs.models import CvVersion, UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

from ..models import Application, ApplicationStatusHistory
from ..services import (
    InvalidApplicationStatusTransition,
    RecruitmentResourceChanged,
    StatusChangeNotUndoable,
    available_status_decisions,
    change_application_status,
    create_application_record,
    mark_application_viewed,
    undo_latest_status_change,
    update_application_assessment,
)
from ..services.automatic_rejection import process_automatic_application_rejections

Status = Application.Status


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

    def decide(self, status, application=None):
        application = application or Application.objects.get(pk=self.application.pk)
        return change_application_status(application, changed_by=self.employer, status=status)

    def test_allows_forward_transition_and_records_matching_timestamp(self):
        application, notice = self.decide(Status.SHORTLISTED)

        self.assertEqual(application.status, Status.SHORTLISTED)
        self.assertIsNotNone(application.shortlisted_at)
        history = application.status_history.get()
        self.assertEqual(history.from_status, Status.SUBMITTED)
        self.assertEqual(history.to_status, Status.SHORTLISTED)
        self.assertEqual(history.changed_by, self.employer)
        self.assertEqual(notice.dedupe_key, history.notification_key)

    def test_viewed_is_system_owned_and_terminal_states_are_final(self):
        self.assertEqual(
            available_status_decisions(self.application),
            list(Application.DECISION_STATUSES),
        )
        with self.assertRaises(InvalidApplicationStatusTransition):
            self.decide(Status.VIEWED)
        Application.objects.filter(pk=self.application.pk).update(
            status=Status.ACCEPTED, accepted_at=timezone.now()
        )
        with self.assertRaises(InvalidApplicationStatusTransition):
            self.decide(Status.REJECTED)
        self.assertFalse(self.application.status_history.exists())

    def test_restricted_candidate_can_only_be_rejected(self):
        self.candidate.status = get_user_model().Status.INACTIVE
        self.candidate.is_active = False
        self.candidate.save(update_fields=['status', 'is_active', 'updated_at'])

        with self.assertRaises(InvalidApplicationStatusTransition):
            self.decide(Status.SHORTLISTED)

        rejected, _notice = self.decide(Status.REJECTED)
        self.assertEqual(rejected.status, Status.REJECTED)

    def test_assessment_never_touches_status_or_history(self):
        original_viewed_at = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            status=Status.VIEWED, viewed_at=original_viewed_at
        )

        application = update_application_assessment(
            self.application,
            changed_by=self.employer,
            employer_note='Internal note',
            employer_rating=4,
        )

        self.assertEqual(
            (application.employer_note, application.employer_rating), ('Internal note', 4)
        )
        self.assertEqual(application.viewed_at, original_viewed_at)
        self.assertFalse(application.status_history.exists())
        self.assertFalse(CandidateNotification.objects.exists())

    def test_stale_application_cannot_override_a_completed_terminal_transition(self):
        stale_application = Application.objects.get(pk=self.application.pk)
        self.decide(Status.ACCEPTED)

        with self.assertRaises(InvalidApplicationStatusTransition):
            self.decide(Status.REJECTED, application=stale_application)

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Status.ACCEPTED)
        self.assertIsNone(self.application.rejected_at)
        self.assertEqual(self.application.status_history.count(), 1)

    def test_mark_viewed_rechecks_a_stale_application_before_mutating(self):
        stale_application = Application.objects.get(pk=self.application.pk)
        self.decide(Status.ACCEPTED)

        application = mark_application_viewed(stale_application, changed_by=self.employer)

        self.assertEqual(application.status, Status.ACCEPTED)
        self.assertIsNone(application.viewed_at)
        self.assertEqual(application.status_history.count(), 1)

    def test_mark_viewed_notifies_candidate_immediately_and_once(self):
        mark_application_viewed(self.application, changed_by=self.employer)
        mark_application_viewed(self.application, changed_by=self.employer)

        notice = CandidateNotification.objects.get()
        self.assertEqual(notice.event_type, CandidateNotification.EventType.APPLICATION_VIEWED)
        self.assertEqual(notice.supersede_key, '')
        self.assertLessEqual(notice.deliver_after, timezone.now())

    def test_mark_viewed_is_silent_for_a_restricted_candidate(self):
        self.candidate.status = get_user_model().Status.INACTIVE
        self.candidate.save(update_fields=['status', 'updated_at'])

        application = mark_application_viewed(self.application, changed_by=self.employer)

        self.assertEqual(application.status, Status.SUBMITTED)
        self.assertFalse(CandidateNotification.objects.exists())

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
                'apps.applications.services.locking.Application.objects.filter',
                return_value=stale_relation,
            ),
            self.assertRaises(RecruitmentResourceChanged),
        ):
            self.decide(Status.SHORTLISTED)

    def test_auto_rejection_can_be_reopened_during_email_grace_period(self):
        rejected_at = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            status=Status.REJECTED,
            rejected_at=rejected_at,
            auto_rejected_at=rejected_at,
            status_updated_at=rejected_at,
        )

        application, _notice = self.decide(Status.SHORTLISTED)

        self.assertEqual(application.status, Status.SHORTLISTED)
        self.assertIsNone(application.auto_rejected_at)
        self.assertIsNone(application.rejected_at)


@override_settings(CANDIDATE_STATUS_NOTIFICATION_DELAY=timedelta(minutes=5))
class StatusDecisionNotificationTests(TestCase):
    def setUp(self):
        self.candidate, self.employer, self.application = create_status_application('notice')

    def decide(self, status):
        application = Application.objects.get(pk=self.application.pk)
        return change_application_status(application, changed_by=self.employer, status=status)

    def undo(self):
        return undo_latest_status_change(
            Application.objects.get(pk=self.application.pk), changed_by=self.employer
        )

    def test_decision_notice_waits_for_the_undo_window(self):
        before = timezone.now()
        _application, notice = self.decide(Status.SHORTLISTED)

        self.assertGreaterEqual(notice.deliver_after, before + timedelta(minutes=5))
        self.assertEqual(release_due_candidate_notifications(), 0)
        self.assertEqual(
            release_due_candidate_notifications(now=notice.deliver_after + timedelta(seconds=1)), 1
        )

    def test_rapid_decisions_leave_only_the_latest_notice(self):
        _app, first = self.decide(Status.SHORTLISTED)
        _app, second = self.decide(Status.INTERVIEWED)

        first.refresh_from_db()
        self.assertEqual(first.cancel_reason, CandidateNotification.CancelReason.SUPERSEDED)
        self.assertIsNone(second.cancelled_at)
        self.assertEqual(
            release_due_candidate_notifications(now=timezone.now() + timedelta(minutes=6)), 1
        )

    def test_undo_restores_status_and_the_previous_decision_notice(self):
        _app, first = self.decide(Status.SHORTLISTED)
        _app, second = self.decide(Status.INTERVIEWED)

        application = self.undo()

        self.assertEqual(application.status, Status.SHORTLISTED)
        self.assertIsNone(application.interviewed_at)
        second.refresh_from_db()
        first.refresh_from_db()
        self.assertEqual(second.cancel_reason, CandidateNotification.CancelReason.UNDONE)
        self.assertIsNone(first.cancelled_at)
        self.assertIsNotNone(
            application.status_history.get(to_status=Status.INTERVIEWED).reverted_at
        )

    def test_undo_after_the_candidate_was_told_is_refused(self):
        _app, notice = self.decide(Status.REJECTED)
        release_due_candidate_notifications(now=notice.deliver_after + timedelta(seconds=1))

        with self.assertRaises(StatusChangeNotUndoable):
            self.undo()
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Status.REJECTED)

    def test_system_view_and_other_recruiters_changes_cannot_be_undone(self):
        mark_application_viewed(self.application, changed_by=self.employer)
        with self.assertRaises(StatusChangeNotUndoable):
            self.undo()


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

    def test_a_replaced_submission_is_never_reminded_or_rejected(self):
        now = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            is_current=False, applied_at=now - timedelta(days=30)
        )

        result = process_automatic_application_rejections(now=now)

        self.assertEqual(result, {'reminded': 0, 'rejected': 0, 'notified': 0})
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.SUBMITTED)

    def test_reminds_recruiter_rejects_stale_application_and_delays_candidate_email(self):
        baseline = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            # Counted from the submission: a later status change never restarts it.
            applied_at=baseline - timedelta(days=18),
            status_updated_at=baseline,
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
        notice = CandidateNotification.objects.get()
        self.assertEqual(notice.event_type, CandidateNotification.EventType.APPLICATION_REJECTED)
        self.assertEqual(notice.email_status, CandidateNotification.EmailStatus.SKIPPED)
        self.assertEqual(
            notice.deliver_after, self.application.auto_rejected_at + timedelta(days=3)
        )

    def test_business_email_switch_skips_emails_but_keeps_the_workflow(self):
        from apps.sitecontent.models import SiteSetting

        SiteSetting.objects.update_or_create(
            key='email_notifications_enabled',
            defaults={'value': False, 'value_type': SiteSetting.ValueType.BOOLEAN},
        )
        baseline = timezone.now()
        Application.objects.filter(pk=self.application.pk).update(
            applied_at=baseline - timedelta(days=18), status_updated_at=baseline
        )

        for days in (0, 3, 6):
            process_automatic_application_rejections(now=baseline + timedelta(days=days))

        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Application.Status.REJECTED)
        # Đánh dấu đã xử lý để bật lại công tắc không gửi bù hàng loạt.
        self.assertIsNotNone(self.application.auto_rejection_email_sent_at)
        self.assertEqual(len(self.mailbox), 0)

    @property
    def mailbox(self):
        from django.core import mail

        return mail.outbox

    def test_disabled_job_is_never_processed(self):
        self.application.job.auto_reject_stale_applications = False
        self.application.job.save(update_fields=['auto_reject_stale_applications', 'updated_at'])
        Application.objects.filter(pk=self.application.pk).update(
            applied_at=timezone.now() - timedelta(days=60),
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
                gate.wait(timeout=5)
                try:
                    change_application_status(
                        stale_application, changed_by=self.employer, status=next_status
                    )
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
    def test_create_application_record_uses_a_new_immutable_snapshot(self):
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
        make_employer_ready(employer, company=company, candidate_data=True)
        job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Application Job',
            description='A role used to test application snapshots.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        application = create_application_record(candidate=candidate, job=job, cv=cv)

        snapshot = CvVersion.objects.get(version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT)
        self.assertEqual(snapshot.parent_version_id, initial.id)
        self.assertEqual(application.submitted_cv_version, snapshot)
        self.assertEqual(application.submitted_cv_title, 'Applied CV')
        self.assertTrue(
            ApplicationStatusHistory.objects.filter(
                application=application,
                from_status='',
                to_status=Application.Status.SUBMITTED,
            ).exists()
        )
        job.refresh_from_db()
        self.assertEqual(job.application_count, 1)
        notice = CandidateNotification.objects.get(recipient=candidate)
        self.assertEqual(notice.event_type, CandidateNotification.EventType.APPLICATION_SUBMITTED)
        self.assertIn('Application Job', notice.message)
        self.assertEqual(notice.metadata['job_public_id'], job.public_id)
