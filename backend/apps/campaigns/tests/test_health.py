from datetime import datetime, timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.applications.models import Application
from apps.campaigns.models import RecruitmentCampaign
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import EmployerNotification, EmployerNotificationPreference
from apps.jobs.models import Job
from apps.jobs.tests import test_posting_workflows
from common.pdf.browser import PdfRenderingError
from common.vietnam_time import VIETNAM_TZ, vietnam_today

from ..models import CampaignChannel, CampaignChannelCost, CampaignHealthSnapshot
from ..selectors import (
    campaign_channel_report,
    campaign_health_history,
    daily_applications,
    report_jobs,
)
from ..services import (
    campaign_health,
    campaign_report_file,
    send_weekly_reports,
    snapshot_campaign,
)

S = Application.Status
NOW = timezone.now()


class HealthFixtures:
    setUp_jobs = test_posting_workflows.JobPostingWorkflowTests.setUp
    make_active_job = test_posting_workflows.JobPostingWorkflowTests.make_active_job
    make_publishable_job = test_posting_workflows.JobPostingWorkflowTests.make_publishable_job

    def setUp(self):
        self.setUp_jobs()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Tuyển kỹ thuật',
            status=RecruitmentCampaign.Status.ACTIVE,
            start_date=vietnam_today() - timedelta(days=10),
            target_date=vietnam_today() + timedelta(days=20),
            activated_at=NOW - timedelta(days=10),
            first_activated_at=NOW - timedelta(days=10),
            budget_max=10_000_000,
        )
        self.job = self.make_active_job(campaign=self.campaign)
        Job.objects.filter(pk=self.job.pk).update(number_of_vacancies=3)
        self.counter = 0

    def apply(self, status, *, days_ago=3, viewed_after_hours=None, **stamps):
        self.counter += 1
        candidate = get_user_model().objects.create_user(
            email=f'health{self.counter}@example.com', password='password', role='candidate'
        )
        cv = UserCv.objects.create(user=candidate, title='CV')
        application = Application.objects.create(
            candidate=candidate,
            job=self.job,
            cv=cv,
            submitted_cv_version=create_initial_document(cv, candidate),
            status=status,
        )
        applied_at = NOW - timedelta(days=days_ago)
        viewed_at = applied_at + timedelta(hours=viewed_after_hours) if viewed_after_hours else None
        Application.objects.filter(pk=application.pk).update(
            applied_at=applied_at, viewed_at=viewed_at, **stamps
        )
        return application

    def seed_pipeline(self):
        """10 current applications; 8 of them in the last 7 days."""
        for _ in range(2):
            self.apply(S.ACCEPTED, viewed_after_hours=2, interviewed_at=NOW, accepted_at=NOW)
        for _ in range(2):
            self.apply(S.INTERVIEWED, viewed_after_hours=5, interviewed_at=NOW)
        self.apply(S.SHORTLISTED, viewed_after_hours=10, shortlisted_at=NOW)
        self.apply(S.SUBMITTED, days_ago=0)
        self.apply(S.SUBMITTED, days_ago=9)
        self.apply(S.SUBMITTED, days_ago=9)
        self.apply(S.REJECTED, viewed_after_hours=72)
        self.apply(S.REJECTED, viewed_after_hours=1)


class CampaignHealthFormulaTests(HealthFixtures, TestCase):
    def test_forecast_matches_the_documented_formula(self):
        self.seed_pipeline()

        health = campaign_health(self.campaign, now=NOW)

        # h = (2 + 10*0.05) / (10 + 10) = 0.125; v7 = 8 / 7
        # pipeline: 3 new*0.05 + 1 shortlisted*0.2 + 2 interviewed*0.4 = 1.15
        # F = 2 + 1.15 + (8/7)*20*0.125 = 6.007
        self.assertEqual(health['hire_rate'], 0.125)
        self.assertEqual(health['velocity_7d'], 1.14)
        self.assertEqual(health['pipeline'], {'new': 3, 'shortlisted': 1, 'interviewed': 2})
        self.assertEqual(health['forecast'], 6.0)
        self.assertEqual(health['status'], 'on_track')
        self.assertIsNone(health['required_velocity'])
        self.assertEqual(health['response']['backlog'], 2)
        self.assertEqual(health['response']['viewed_within_48h_percent'], 66.7)
        self.assertEqual(health['stage_rate_sources']['interviewed'], 'default')
        funnel = {row['stage']: row['count'] for row in health['funnel']}
        self.assertEqual(
            funnel, {'applied': 10, 'viewed': 7, 'shortlisted': 5, 'interviewed': 4, 'accepted': 2}
        )

    def test_a_big_target_is_off_track_and_says_how_many_applications_are_needed(self):
        Job.objects.filter(pk=self.job.pk).update(number_of_vacancies=20)
        self.seed_pipeline()

        health = campaign_health(self.campaign, now=NOW)

        self.assertEqual(health['status'], 'off_track')
        # (20 - 2 - 1.15) / (0.125 * 20) = 6.74
        self.assertEqual(health['required_velocity'], 6.74)
        self.assertIn('forecast_at_risk', health['alerts'])

    def test_young_campaigns_and_campaigns_without_jobs_are_not_judged(self):
        young = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Mới chạy',
            status=RecruitmentCampaign.Status.ACTIVE,
            activated_at=NOW - timedelta(days=1),
        )
        Job.objects.filter(pk=self.job.pk).update(campaign=young)

        self.assertEqual(campaign_health(young, now=NOW)['status'], 'insufficient_data')
        self.assertEqual(campaign_health(self.campaign, now=NOW)['status'], 'no_target')

    def test_budget_burn_and_silent_channels(self):
        channel = CampaignChannel.objects.create(
            campaign=self.campaign,
            kind='facebook_group',
            label='Nhóm IT',
            posted_at=NOW - timedelta(days=6),
        )
        CampaignChannelCost.objects.create(
            channel=channel, amount=6_000_000, incurred_on=vietnam_today()
        )

        health = campaign_health(self.campaign, now=NOW)

        # 60% of the budget spent after 10 of 31 planned days -> burn ratio 1.86
        self.assertEqual(health['budget']['used_percent'], 60.0)
        self.assertEqual(health['budget']['burn_ratio'], 1.86)
        self.assertEqual(health['silent_channels'], [{'label': 'Nhóm IT', 'clicks': 0}])
        self.assertIn('budget_overburn', health['alerts'])
        self.assertIn('channel_zero_apply', health['alerts'])


class CampaignHealthMonitoringTests(HealthFixtures, TestCase):
    def alerts(self):
        return EmployerNotification.objects.filter(
            event_type=EmployerNotification.EventType.CAMPAIGN_HEALTH_ALERT
        )

    def test_alerts_fire_on_transition_and_repeat_at_most_weekly(self):
        for _ in range(5):
            self.apply(S.SUBMITTED, days_ago=3)

        snapshot_campaign(self.campaign, now=NOW)
        snapshot_campaign(self.campaign, now=NOW)
        snapshot_campaign(self.campaign, now=NOW + timedelta(days=3))
        snapshot_campaign(self.campaign, now=NOW + timedelta(days=8))

        backlog = [n for n in self.alerts() if n.metadata.get('rule') == 'backlog']
        self.assertEqual(len(backlog), 2)
        self.assertEqual(CampaignHealthSnapshot.objects.filter(campaign=self.campaign).count(), 3)
        latest = CampaignHealthSnapshot.objects.filter(campaign=self.campaign).first()
        self.assertEqual(latest.open_alerts['backlog']['since'], vietnam_today(NOW).isoformat())

    def test_weekly_report_goes_out_once_on_monday_morning(self):
        monday = datetime(2026, 11, 23, 9, 0, tzinfo=VIETNAM_TZ)
        tuesday = monday + timedelta(days=1)

        sent = send_weekly_reports(now=monday)
        again = send_weekly_reports(now=monday + timedelta(hours=1))
        later = send_weekly_reports(now=tuesday)
        EmployerNotificationPreference.objects.update_or_create(
            recipient=self.user, defaults={'campaign_weekly_report_email': False}
        )
        next_week = send_weekly_reports(now=monday + timedelta(days=7))

        self.assertEqual((sent, again, later, next_week), (1, 0, 0, 0))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Báo cáo tuần: Tuyển kỹ thuật', mail.outbox[0].subject)
        self.assertIn('active_tab=health', mail.outbox[0].body)


class CampaignHealthApiTests(HealthFixtures, TestCase):
    def test_health_endpoint_returns_indicators_and_history(self):
        self.seed_pipeline()
        snapshot_campaign(self.campaign, now=NOW)

        response = self.client.get(
            reverse('employer-campaign-health', kwargs={'public_id': self.campaign.public_id})
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['health']['headcount'], 3)
        self.assertEqual(len(response.data['history']), 1)

    def test_excel_export_has_the_report_sheets(self):
        from openpyxl import load_workbook

        self.seed_pipeline()
        response = self.client.get(
            reverse(
                'employer-campaign-report-export', kwargs={'public_id': self.campaign.public_id}
            ),
            {'type': 'xlsx'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment', response['Content-Disposition'])
        workbook = load_workbook(BytesIO(response.content))
        self.assertEqual(
            workbook.sheetnames,
            ['Tổng quan', 'Phễu', 'Nguồn và chi phí', 'Theo ngày', 'Tin tuyển dụng'],
        )
        self.assertEqual(workbook['Tổng quan']['B1'].value, 'Tuyển kỹ thuật')

    def test_pdf_export_renders_a_self_contained_report(self):
        with patch(
            'apps.campaigns.services.report_export.render_html_pdf', return_value=b'%PDF-1.7 test'
        ) as render:
            response = self.client.get(
                reverse(
                    'employer-campaign-report-export', kwargs={'public_id': self.campaign.public_id}
                ),
                {'type': 'pdf'},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        html = render.call_args.args[0]
        self.assertIn('Báo cáo chiến dịch: Tuyển kỹ thuật', html)
        self.assertNotIn(
            'http://', html.split('<body>')[1].split('</body>')[0].replace('xmlns', '')
        )


class CampaignReportServiceTests(HealthFixtures, TestCase):
    def report_reads(self):
        return {
            'channels': campaign_channel_report(self.campaign),
            'daily': daily_applications(self.campaign),
            'jobs': report_jobs(self.campaign),
        }

    def test_history_is_oldest_first_and_capped(self):
        today = vietnam_today()
        for offset in range(3):
            CampaignHealthSnapshot.objects.create(
                campaign=self.campaign,
                date=today - timedelta(days=offset),
                status=CampaignHealthSnapshot.Status.ON_TRACK,
                metrics={'forecast': offset, 'headcount': 3},
            )

        history = campaign_health_history(self.campaign, days=2)

        self.assertEqual([row['date'] for row in history], [today - timedelta(days=1), today])
        self.assertEqual(history[-1]['forecast'], 0)
        self.assertIsNone(history[-1]['accepted'])

    def test_pdf_failure_is_a_validation_error_for_the_recruiter(self):
        with patch(
            'apps.campaigns.services.report_export.render_html_pdf',
            side_effect=PdfRenderingError('chromium down'),
        ):
            with self.assertRaises(ValidationError) as caught:
                campaign_report_file(self.campaign, 'pdf', **self.report_reads())

        self.assertIn('PDF', str(caught.exception.detail['detail']))

    def test_xlsx_report_carries_its_content_type(self):
        content, content_type = campaign_report_file(self.campaign, 'xlsx', **self.report_reads())

        self.assertTrue(content.startswith(b'PK'))
        self.assertEqual(
            content_type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
