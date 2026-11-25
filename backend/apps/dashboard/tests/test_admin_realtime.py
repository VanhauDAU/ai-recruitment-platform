"""Admin queue changes reach open admin sockets as a bare queue key."""

from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.employers.models import Company, CompanyJoinRequest
from apps.employers.services import cancel_company_join
from apps.employers.tests.factories import make_recruiter
from apps.jobs.models import Job, JobReport
from apps.realtime.domain import ADMIN_GROUP


class RecordingLayer:
    def __init__(self):
        self.sent = []

    async def group_send(self, group, message):
        self.sent.append((group, message['event']))


class AdminQueuePushTests(TestCase):
    def setUp(self):
        self.layer = RecordingLayer()
        patcher = patch('apps.realtime.services.publish.get_channel_layer', return_value=self.layer)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.owner, _ = make_recruiter('queue-owner@example.com')
        self.company = Company.objects.create(
            company_name='Công ty Hàng chờ', tax_code='0101234999', created_by=self.owner
        )
        self.job = Job.objects.create(
            posted_by=self.owner, company=self.company, title='Tin', description='Mô tả'
        )

    def queues(self):
        return [event['queue'] for group, event in self.layer.sent if group == ADMIN_GROUP]

    def test_new_report_tells_admins_which_queue_changed_and_nothing_else(self):
        with self.captureOnCommitCallbacks(execute=True):
            JobReport.objects.create(job=self.job, reason=JobReport.Reason.SCAM)

        self.assertEqual(
            self.layer.sent,
            [(ADMIN_GROUP, {'type': 'admin.queue.changed', 'queue': 'job_reports'})],
        )

    def test_rolled_back_write_is_never_pushed(self):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            JobReport.objects.create(job=self.job, reason=JobReport.Reason.SCAM)

        self.assertEqual(len(callbacks), 1)
        self.assertEqual(self.layer.sent, [])

    def test_only_moderation_fields_move_a_job_through_the_resubmission_queue(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.job.title = 'Tin mới'
            self.job.save(update_fields=['title', 'updated_at'])
            self.job.save()
        self.assertEqual(self.queues(), [])

        with self.captureOnCommitCallbacks(execute=True):
            self.job.moderation_hold = Job.ModerationHold.CHANGES_REQUESTED
            self.job.save(update_fields=['moderation_hold', 'updated_at'])
            self.job.moderation_resubmitted_at = timezone.now()
            self.job.save()
        self.assertEqual(self.queues(), ['job_resubmissions', 'job_resubmissions'])

    def test_bulk_cancel_without_signals_still_notifies(self):
        user, recruiter = make_recruiter('queue-joiner@example.com')
        CompanyJoinRequest.objects.create(recruiter=recruiter, company=self.company)
        self.layer.sent.clear()

        with self.captureOnCommitCallbacks(execute=True):
            cancel_company_join(user)

        self.assertEqual(self.queues(), ['company_join_requests'])
