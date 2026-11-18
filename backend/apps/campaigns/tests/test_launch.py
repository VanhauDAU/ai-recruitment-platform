from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.employers.models import EmployerNotification
from apps.jobs.models import Job
from apps.jobs.services import RESPONSIBILITY_STATEMENT_VERSION
from apps.jobs.tests.factories import JobPostingFixture
from common.vietnam_time import vietnam_today

from ..models import CampaignLaunchPlan
from ..services import run_campaign_schedule

Status = RecruitmentCampaign.Status


class CampaignLaunchTests(JobPostingFixture, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.today = vietnam_today()

    def make_campaign(self, **overrides):
        data = {
            'owner': self.recruiter,
            'company': self.company,
            'name': 'Tuyển Backend Q4',
            'target_date': self.today + timedelta(days=30),
        }
        data.update(overrides)
        return RecruitmentCampaign.objects.create(**data)

    def launch_url(self, campaign):
        return reverse('employer-campaign-launch', kwargs={'public_id': campaign.public_id})

    def select(self, campaign, *, publish=(), attach=()):
        return self.client.put(
            self.launch_url(campaign),
            {
                'publish_job_ids': [job.public_id for job in publish],
                'attach_job_ids': [job.public_id for job in attach],
            },
            format='json',
        )

    def launch(self, campaign, mode='now', version=RESPONSIBILITY_STATEMENT_VERSION):
        return self.client.post(
            self.launch_url(campaign),
            {'mode': mode, 'accepted_statement_version': version},
            format='json',
        )

    def test_launch_publishes_drafts_and_attaches_public_jobs(self):
        campaign = self.make_campaign()
        draft = self.make_publishable_job(title='Draft in campaign')
        draft.campaign = campaign
        draft.save(update_fields=['campaign'])
        public_job = self.make_active_job()

        overview = self.client.get(self.launch_url(campaign))
        selected = self.select(campaign, publish=[draft], attach=[public_job])
        launched = self.launch(campaign)

        self.assertEqual(overview.status_code, 200, overview.data)
        self.assertEqual(
            [row['public_id'] for row in overview.data['draft_jobs']], [draft.public_id]
        )
        self.assertIn(
            public_job.public_id, [row['public_id'] for row in overview.data['attachable_jobs']]
        )
        self.assertFalse(overview.data['check']['ready'])
        self.assertEqual(selected.status_code, 200, selected.data)
        self.assertTrue(selected.data['check']['ready'], selected.data['check'])
        self.assertEqual(launched.status_code, 200, launched.data)
        campaign.refresh_from_db()
        draft.refresh_from_db()
        public_job.refresh_from_db()
        self.assertEqual(campaign.status, Status.ACTIVE)
        self.assertEqual(campaign.start_date, self.today)
        self.assertIsNotNone(campaign.first_activated_at)
        self.assertEqual(draft.status, Job.Status.ACTIVE)
        self.assertEqual(public_job.campaign_id, campaign.pk)
        self.assertFalse(CampaignLaunchPlan.objects.get(campaign=campaign).jobs.exists())
        self.assertTrue(
            campaign.activities.filter(
                event_type=CampaignActivity.EventType.CAMPAIGN_ACTIVATED
            ).exists()
        )

    def test_launch_is_all_or_nothing_and_requires_the_current_statement(self):
        campaign = self.make_campaign()
        ready = self.make_publishable_job(title='Ready draft')
        incomplete = self.make_publishable_job(title='Incomplete draft')
        Job.objects.filter(pk__in=[ready.pk, incomplete.pk]).update(campaign=campaign)
        Job.objects.filter(pk=incomplete.pk).update(benefits='')
        self.select(campaign, publish=[ready, incomplete])

        stale_statement = self.launch(campaign, version='2020-01')
        not_ready = self.launch(campaign)

        self.assertEqual(stale_statement.status_code, 400)
        self.assertEqual(stale_statement.data['code'], 'JOB_RESPONSIBILITY_REQUIRED')
        self.assertEqual(not_ready.status_code, 400)
        self.assertEqual(not_ready.data['code'], 'CAMPAIGN_NOT_READY')
        self.assertEqual(
            [row['public_id'] for row in not_ready.data['job_problems']], [incomplete.public_id]
        )
        campaign.refresh_from_db()
        ready.refresh_from_db()
        self.assertEqual(campaign.status, Status.DRAFT)
        self.assertEqual(ready.status, Job.Status.DRAFT)

    def test_selection_refuses_jobs_the_campaign_cannot_take(self):
        campaign = self.make_campaign()
        other = self.make_campaign(name='Running', status=Status.ACTIVE)
        busy = self.make_active_job(campaign=other)
        foreign_draft = self.make_publishable_job(owner=self.other_user)

        busy_response = self.select(campaign, attach=[busy])
        foreign_response = self.select(campaign, publish=[foreign_draft])

        self.assertEqual(busy_response.status_code, 400)
        self.assertIn('attach_job_ids', busy_response.data)
        self.assertEqual(foreign_response.status_code, 400)
        self.assertIn('publish_job_ids', foreign_response.data)

    def test_scheduled_campaign_activates_on_its_start_date(self):
        start = self.today + timedelta(days=2)
        campaign = self.make_campaign(start_date=start)
        draft = self.make_publishable_job()
        draft.campaign = campaign
        draft.save(update_fields=['campaign'])
        self.select(campaign, publish=[draft])

        scheduled = self.launch(campaign, mode='scheduled')
        early_run = run_campaign_schedule(today=self.today)
        due_run = run_campaign_schedule(today=start)
        repeat_run = run_campaign_schedule(today=start)

        self.assertEqual(scheduled.status_code, 200, scheduled.data)
        self.assertEqual(scheduled.data['status'], Status.SCHEDULED)
        self.assertEqual(early_run['activated'], 0)
        self.assertEqual(due_run['activated'], 1)
        self.assertEqual(repeat_run['activated'], 0)
        campaign.refresh_from_db()
        draft.refresh_from_db()
        self.assertEqual(campaign.status, Status.ACTIVE)
        self.assertEqual(draft.status, Job.Status.ACTIVE)
        self.assertEqual(
            EmployerNotification.objects.filter(
                recipient=self.user,
                event_type=EmployerNotification.EventType.CAMPAIGN_ACTIVATED,
            ).count(),
            1,
        )

    def test_scheduling_needs_a_future_start_date(self):
        campaign = self.make_campaign(start_date=self.today)
        draft = self.make_publishable_job()
        draft.campaign = campaign
        draft.save(update_fields=['campaign'])
        self.select(campaign, publish=[draft])

        response = self.launch(campaign, mode='scheduled')

        self.assertEqual(response.status_code, 400)
        self.assertIn('start_date', [item['code'] for item in response.data['items']])

    def test_failed_scheduled_activation_stays_scheduled_and_notifies_once(self):
        start = self.today + timedelta(days=1)
        campaign = self.make_campaign(start_date=start, status=Status.SCHEDULED)
        draft = self.make_publishable_job()
        draft.campaign = campaign
        draft.save(update_fields=['campaign'])
        self.select(campaign, publish=[draft])
        CampaignLaunchPlan.objects.filter(campaign=campaign).update(
            accepted_statement_version='2020-01'
        )

        first = run_campaign_schedule(today=start)
        second = run_campaign_schedule(today=start)

        self.assertEqual(first['activation_failed'], 1)
        self.assertEqual(second['activation_failed'], 1)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, Status.SCHEDULED)
        plan = CampaignLaunchPlan.objects.get(campaign=campaign)
        self.assertEqual(plan.last_error['error']['code'], 'JOB_RESPONSIBILITY_REQUIRED')
        self.assertEqual(
            EmployerNotification.objects.filter(
                event_type=EmployerNotification.EventType.CAMPAIGN_ACTIVATION_FAILED
            ).count(),
            1,
        )

    def test_scheduler_ends_expired_campaigns_and_warns_before_the_end(self):
        expired = self.make_campaign(
            status=Status.ACTIVE, target_date=self.today - timedelta(days=1)
        )
        job = self.make_active_job(campaign=expired, deadline=self.today - timedelta(days=1))
        continuous = self.make_campaign(status=Status.ACTIVE, is_continuous=True, target_date=None)
        ending = self.make_campaign(
            status=Status.ACTIVE, target_date=self.today + timedelta(days=3)
        )
        held = self.make_campaign(
            status=Status.ACTIVE,
            target_date=self.today - timedelta(days=1),
            policy_hold=RecruitmentCampaign.PolicyHold.TEMPORARY_LOCK,
        )

        result = run_campaign_schedule(today=self.today)
        run_campaign_schedule(today=self.today)

        self.assertEqual(result['completed'], 1)
        expired.refresh_from_db()
        job.refresh_from_db()
        continuous.refresh_from_db()
        held.refresh_from_db()
        self.assertEqual(expired.status, Status.COMPLETED)
        self.assertEqual(expired.ended_by, RecruitmentCampaign.EndedBy.SYSTEM)
        self.assertEqual(job.status, Job.Status.CLOSED)
        self.assertEqual(continuous.status, Status.ACTIVE)
        self.assertEqual(held.status, Status.ACTIVE)
        self.assertEqual(
            EmployerNotification.objects.filter(
                event_type=EmployerNotification.EventType.CAMPAIGN_ENDING_SOON,
                metadata__campaign_public_id=ending.public_id,
            ).count(),
            1,
        )

    def test_paused_time_is_excluded_from_running_days(self):
        campaign = self.make_campaign()
        draft = self.make_publishable_job()
        draft.campaign = campaign
        draft.save(update_fields=['campaign'])
        self.select(campaign, publish=[draft])
        self.launch(campaign)
        campaign.refresh_from_db()
        RecruitmentCampaign.objects.filter(pk=campaign.pk).update(
            activated_at=campaign.activated_at - timedelta(days=2)
        )

        self.client.post(
            reverse('employer-campaign-status', kwargs={'public_id': campaign.public_id}),
            {'status': 'paused', 'confirmation_code': campaign.public_id},
            format='json',
        )
        detail = self.client.get(
            reverse('employer-campaign-detail', kwargs={'public_id': campaign.public_id})
        )

        self.assertEqual(detail.data['status'], Status.PAUSED)
        self.assertAlmostEqual(detail.data['active_days'], 2.0, delta=0.1)
