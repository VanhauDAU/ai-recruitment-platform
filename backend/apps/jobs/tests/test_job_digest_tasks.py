"""Celery wiring and retention of the job digest outbox."""

from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from celery.exceptions import Retry
from django.conf import settings
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from apps.accounts.models import User
from common.metrics import ALLOWED_METRICS

from ..models import (
    CandidateJobDigest,
)
from ..services.digests import (
    purge_candidate_job_digest_history,
)
from ..tasks import deliver_candidate_job_digest as deliver_candidate_job_digest_task
from ..tasks import prepare_candidate_job_digest as prepare_candidate_job_digest_task
from ..tasks import prepare_due_candidate_job_digests as prepare_due_candidate_job_digests_task


class CandidateJobAlertTaskContractTests(SimpleTestCase):
    @patch('apps.jobs.tasks.alerts.deliver_digest_service', side_effect=RuntimeError('SMTP'))
    def test_delivery_task_passes_exception_to_celery_retry(self, _service):
        with patch.object(
            deliver_candidate_job_digest_task,
            'retry',
            side_effect=Retry(),
        ) as retry:
            with self.assertRaises(Retry):
                deliver_candidate_job_digest_task.run(123)

        self.assertIsInstance(retry.call_args.kwargs['exc'], RuntimeError)
        self.assertEqual(retry.call_args.kwargs['countdown'], 2)

    def test_beat_route_and_worker_consume_candidate_email_queue(self):
        self.assertIn('candidate_job_digest', ALLOWED_METRICS)
        beat_tasks = {entry['task'] for entry in settings.CELERY_BEAT_SCHEDULE.values()}
        self.assertIn('apps.jobs.tasks.prepare_due_candidate_job_digests', beat_tasks)
        self.assertIn('apps.jobs.tasks.dispatch_pending_candidate_job_digests', beat_tasks)
        self.assertIn('apps.jobs.tasks.purge_candidate_job_digest_history', beat_tasks)
        self.assertEqual(
            settings.CELERY_TASK_ROUTES['apps.jobs.tasks.*']['queue'],
            'candidate-email',
        )
        compose_path = Path(__file__).resolve().parents[4] / 'docker-compose.yml'
        if not compose_path.exists():
            self.skipTest('Repository root is not mounted in this backend runtime.')
        compose = compose_path.read_text(encoding='utf-8')
        self.assertIn('upload-scan,candidate-email', compose)

    @patch('apps.jobs.tasks.alerts.prepare_candidate_job_digest.delay')
    @patch(
        'apps.jobs.tasks.alerts.claim_due_candidates_service',
        return_value=[
            {'candidate_id': 11, 'claimed_at': '2026-08-11T01:00:00+00:00'},
            {'candidate_id': 12, 'claimed_at': '2026-08-11T01:00:00+00:00'},
        ],
    )
    def test_beat_fans_out_bounded_candidate_preparation(self, _claims, prepare_delay):
        result = prepare_due_candidate_job_digests_task.run()

        self.assertEqual(result, 2)
        self.assertEqual(
            [call.args for call in prepare_delay.call_args_list],
            [
                (11, '2026-08-11T01:00:00+00:00'),
                (12, '2026-08-11T01:00:00+00:00'),
            ],
        )
        self.assertEqual(
            prepare_candidate_job_digest_task.name,
            'apps.jobs.tasks.prepare_candidate_job_digest',
        )

    @patch('apps.jobs.tasks.alerts.release_candidate_job_digest_claim')
    @patch(
        'apps.jobs.tasks.alerts.prepare_candidate_job_digest.delay',
        side_effect=RuntimeError('broker unavailable'),
    )
    @patch(
        'apps.jobs.tasks.alerts.claim_due_candidates_service',
        return_value=[{'candidate_id': 11, 'claimed_at': '2026-08-11T01:00:00+00:00'}],
    )
    def test_beat_releases_claim_when_prepare_publish_fails(
        self,
        _claims,
        _prepare_delay,
        release_claim,
    ):
        result = prepare_due_candidate_job_digests_task.run()

        self.assertEqual(result, 1)
        release_claim.assert_called_once_with(11, '2026-08-11T01:00:00+00:00')


class CandidateJobDigestRetentionTests(TestCase):
    def test_retention_removes_old_terminal_history_but_keeps_pending(self):
        now = timezone.now()
        candidate = User.objects.create_user(
            email='digest-retention@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        terminal = CandidateJobDigest.objects.create(
            candidate=candidate,
            scheduled_for=now - timedelta(days=100),
            recipient_email=candidate.email,
            recipient_auth_revision=candidate.auth_revision,
            status=CandidateJobDigest.Status.SENT,
        )
        pending = CandidateJobDigest.objects.create(
            candidate=candidate,
            scheduled_for=now - timedelta(days=101),
            recipient_email=candidate.email,
            recipient_auth_revision=candidate.auth_revision,
            status=CandidateJobDigest.Status.PENDING,
        )
        CandidateJobDigest.objects.filter(pk__in=[terminal.pk, pending.pk]).update(
            created_at=now - timedelta(days=100)
        )

        result = purge_candidate_job_digest_history(now)

        self.assertGreaterEqual(result['digests'], 1)
        self.assertFalse(CandidateJobDigest.objects.filter(pk=terminal.pk).exists())
        self.assertTrue(CandidateJobDigest.objects.filter(pk=pending.pk).exists())
