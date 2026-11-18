"""Verification revoke racing a job publication on separate connections."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event
from unittest.mock import patch

from django.db import close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.accounts.services import StaleImpactToken
from apps.campaigns.models import RecruitmentCampaign
from apps.jobs.models import Job
from apps.jobs.selectors import active_jobs_queryset
from apps.jobs.services import RESPONSIBILITY_STATEMENT_VERSION, reopen_job

from ..models import (
    Company,
    EmployerComplianceHold,
    EmployerComplianceHoldJob,
    EmployerVerificationCase,
)
from ..services import (
    confirm_verification_lifecycle_action,
    lock_verification_identity,
    verification_lifecycle_impact,
)
from .factories import make_employer_ready


class EmployerVerificationJobPublicationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='er5-concurrency-admin@example.com',
            password='Password@123',
        )
        self.employer = User.objects.create_user(
            email='er5-concurrency-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='ER-5 Concurrency Company',
            tax_code='0312345699',
            created_by=self.employer,
        )
        self.recruiter = make_employer_ready(
            self.employer,
            company=self.company,
            candidate_data=True,
        )
        self.case = self.recruiter.verification_case
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='ER-5 concurrency campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='ER-5 concurrent publication job',
            description='Exercise the canonical U-R-Case-Company-Campaign-Job locks.',
            status=Job.Status.CLOSED,
            submitted_at=timezone.now(),
            closed_at=timezone.now(),
        )

    def _impact(self):
        self.case.refresh_from_db()
        return verification_lifecycle_impact(
            self.case,
            actor=self.admin,
            action=EmployerVerificationCase.Status.REVOKED,
            reason='Concurrency regression revoke.',
        )

    def _publish_in_thread(self):
        # Reopening a closed job is a publication: it makes the job public
        # again behind the same employer gate as the first publish.
        close_old_connections()
        try:
            try:
                reopen_job(
                    Job.objects.get(pk=self.job.pk),
                    User.objects.get(pk=self.employer.pk),
                    timezone.localdate() + timedelta(days=14),
                    accepted_statement_version=RESPONSIBILITY_STATEMENT_VERSION,
                )
            except ValidationError as error:
                return error.detail
            return 'published'
        finally:
            close_old_connections()

    def test_revoke_commits_first_and_concurrent_job_publication_fails_closed(self):
        impact = self._impact()
        revoke_locked = Event()
        allow_revoke = Event()
        publication_attempted = Event()
        from apps.employers.services.verification.lifecycle import (
            apply_verification_hold as real_apply_verification_hold,
        )

        def pause_revoke(scope, *, reason, actor):
            revoke_locked.set()
            if not allow_revoke.wait(timeout=10):
                raise AssertionError('Timed out before committing verification revoke.')
            return real_apply_verification_hold(scope, reason=reason, actor=actor)

        from apps.jobs.services.posting.locking import _locked_recruiter as real_locked_recruiter

        def signal_publication_attempt(*args, **kwargs):
            publication_attempted.set()
            return real_locked_recruiter(*args, **kwargs)

        def revoke_in_thread():
            close_old_connections()
            try:
                return confirm_verification_lifecycle_action(
                    EmployerVerificationCase.objects.get(pk=self.case.pk),
                    actor=User.objects.get(pk=self.admin.pk),
                    action=EmployerVerificationCase.Status.REVOKED,
                    reason='Concurrency regression revoke.',
                    impact_token=impact['impact_token'],
                ).status
            finally:
                close_old_connections()

        with (
            patch(
                'apps.employers.services.verification.lifecycle.apply_verification_hold',
                side_effect=pause_revoke,
            ),
            patch(
                'apps.jobs.services.posting.publication._locked_recruiter',
                side_effect=signal_publication_attempt,
            ),
            ThreadPoolExecutor(max_workers=2) as pool,
        ):
            revoke = pool.submit(revoke_in_thread)
            self.assertTrue(revoke_locked.wait(timeout=10))
            publication = pool.submit(self._publish_in_thread)
            self.assertTrue(publication_attempted.wait(timeout=10))
            allow_revoke.set()
            self.assertEqual(revoke.result(timeout=10), EmployerVerificationCase.Status.REVOKED)
            publication_error = publication.result(timeout=10)

        self.assertEqual(str(publication_error['code']), 'JOB_PUBLICATION_BLOCKED')
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.CLOSED)
        self.assertFalse(active_jobs_queryset().filter(pk=self.job.pk).exists())

    def test_publication_commits_first_then_revoke_repreviews_links_and_hides_job(self):
        stale_impact = self._impact()
        publication_locked = Event()
        allow_publication = Event()
        revoke_attempted = Event()
        from apps.jobs.services.posting.rules import (
            _ensure_publication_allowed as real_ensure_publication_allowed,
        )

        def pause_publication_gate(job, publication_state):
            publication_locked.set()
            if not allow_publication.wait(timeout=10):
                raise AssertionError('Timed out before committing job publication.')
            return real_ensure_publication_allowed(job, publication_state)

        real_lock = lock_verification_identity

        def signal_revoke_lock(*args, **kwargs):
            revoke_attempted.set()
            return real_lock(*args, **kwargs)

        def revoke_with_repreview():
            close_old_connections()
            try:
                actor = User.objects.get(pk=self.admin.pk)
                case = EmployerVerificationCase.objects.get(pk=self.case.pk)
                try:
                    confirm_verification_lifecycle_action(
                        case,
                        actor=actor,
                        action=EmployerVerificationCase.Status.REVOKED,
                        reason='Concurrency regression revoke.',
                        impact_token=stale_impact['impact_token'],
                    )
                except StaleImpactToken:
                    case.refresh_from_db()
                    fresh = verification_lifecycle_impact(
                        case,
                        actor=actor,
                        action=EmployerVerificationCase.Status.REVOKED,
                        reason='Concurrency regression revoke.',
                    )
                    confirm_verification_lifecycle_action(
                        case,
                        actor=actor,
                        action=EmployerVerificationCase.Status.REVOKED,
                        reason='Concurrency regression revoke.',
                        impact_token=fresh['impact_token'],
                    )
                    return 'stale_then_revoked'
                return 'unexpectedly_not_stale'
            finally:
                close_old_connections()

        with (
            patch(
                'apps.jobs.services.posting.publication._ensure_publication_allowed',
                side_effect=pause_publication_gate,
            ),
            patch(
                'apps.employers.services.verification.lifecycle.lock_verification_identity',
                side_effect=signal_revoke_lock,
            ),
            ThreadPoolExecutor(max_workers=2) as pool,
        ):
            publication = pool.submit(self._publish_in_thread)
            self.assertTrue(publication_locked.wait(timeout=10))
            revoke = pool.submit(revoke_with_repreview)
            self.assertTrue(revoke_attempted.wait(timeout=10))
            allow_publication.set()
            self.assertEqual(publication.result(timeout=10), 'published')
            self.assertEqual(revoke.result(timeout=10), 'stale_then_revoked')

        self.job.refresh_from_db()
        self.case.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.REVOKED)
        self.assertTrue(
            EmployerComplianceHoldJob.objects.filter(
                hold__recruiter=self.recruiter,
                hold__status=EmployerComplianceHold.Status.ACTIVE,
                job=self.job,
            ).exists()
        )
        self.assertFalse(active_jobs_queryset().filter(pk=self.job.pk).exists())
