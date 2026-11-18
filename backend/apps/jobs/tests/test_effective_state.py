"""One effective state per job, the same on every surface (GĐ1)."""

from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.applications.services import ApplicationNotAllowed, create_application_record
from apps.campaigns.models import RecruitmentCampaign
from apps.campaigns.selectors import campaign_list_queryset
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.services import create_v2_cv
from apps.dashboard.selectors import build_employer_dashboard
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from common.vietnam_time import vietnam_day_start, vietnam_today

from ..models import Job, JobState, publicly_available_job_filter
from ..models.querysets import job_visibility_issues
from ..selectors import admin_job_management_summary, employer_job_status_counts
from .helpers import open_visibility_window

# 18:30 UTC on 15/11 is already 01:30 on 16/11 in Vietnam.
VIETNAM_EARLY_MORNING = datetime(2026, 11, 15, 18, 30, tzinfo=UTC)


class JobEffectiveStateTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.employer = users.create_user(
            email='state-employer@example.com', password='password', role='employer'
        )
        self.company = Company.objects.create(company_name='State Co', created_by=self.employer)
        self.recruiter = make_employer_ready(
            self.employer, company=self.company, candidate_data=True
        )
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='State campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )

    def make_job(self, **fields):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='State job',
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            **{**open_visibility_window(), **fields},
        )

    def surfaces(self):
        """What the employer list, campaign, admin and dashboard each call active/expired."""
        campaign = campaign_list_queryset(self.employer).get(pk=self.campaign.pk)
        summary = build_employer_dashboard(self.employer)['summary']
        employer_counts = employer_job_status_counts(self.employer)
        admin = admin_job_management_summary()
        return {
            'employer': (employer_counts['active'], employer_counts['expired']),
            'campaign': (campaign.active_job_count, campaign.expired_job_count),
            'admin': (admin['active'], admin['expired']),
            'dashboard_active': summary['jobs_active'],
        }

    def test_deadline_follows_the_vietnamese_calendar_on_every_surface(self):
        with patch('django.utils.timezone.now', return_value=VIETNAM_EARLY_MORNING):
            self.make_job(deadline=date(2026, 11, 15))
            self.make_job(deadline=date(2026, 11, 16))

            surfaces = self.surfaces()

        self.assertEqual(surfaces['employer'], (1, 1))
        self.assertEqual(surfaces['campaign'], (1, 1))
        self.assertEqual(surfaces['admin'], (1, 1))
        self.assertEqual(surfaces['dashboard_active'], 1)

    def test_held_or_expired_jobs_are_never_counted_as_recruiting(self):
        self.make_job()
        self.make_job(moderation_hold=Job.ModerationHold.MANUAL_REVIEW)
        self.make_job(
            visibility_starts_at=timezone.now() - timedelta(days=10),
            visibility_ends_at=timezone.now() - timedelta(hours=1),
        )

        surfaces = self.surfaces()

        self.assertEqual(surfaces['employer'], (1, 1))
        self.assertEqual(surfaces['campaign'], (1, 1))
        self.assertEqual(surfaces['admin'], (1, 1))
        self.assertEqual(surfaces['dashboard_active'], 1)
        self.assertEqual(employer_job_status_counts(self.employer)['hidden'], 1)

    def test_losing_the_current_dpa_hides_the_job_and_explains_why(self):
        job = self.make_job()
        self.recruiter.dpa_policy_version = 'old-version'
        self.recruiter.save(update_fields=['dpa_policy_version', 'updated_at'])

        self.assertFalse(Job.objects.filter(publicly_available_job_filter(), pk=job.pk).exists())
        self.assertEqual(
            [(issue['code'], issue['action']) for issue in job_visibility_issues(job)],
            [('dpa_required', 'accept_current_dpa')],
        )

    def test_reasons_cover_company_page_and_campaign_holds(self):
        job = self.make_job()
        Company.objects.filter(pk=self.company.pk).update(content_policy_hold=True)
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(
            status=RecruitmentCampaign.Status.PAUSED
        )

        self.assertEqual(
            [issue['code'] for issue in job_visibility_issues(job)],
            ['company_hidden', 'campaign_unavailable'],
        )
        self.assertEqual(employer_job_status_counts(self.employer)[JobState.HIDDEN], 1)

    def test_public_job_has_no_issues(self):
        self.assertEqual(job_visibility_issues(self.make_job()), [])


class ApplicationRequiresCandidateDataAccessTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='state-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        employer = users.create_user(
            email='state-poster@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Apply State Co', created_by=employer)
        self.recruiter = make_employer_ready(employer, company=company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Apply state job',
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        template, _version = make_published_template('State template')
        self.cv = create_v2_cv(actor=self.candidate, title='State CV', template=template)
        fill_cv_for_application(self.cv, self.candidate)

    def test_job_stops_taking_applications_once_the_employer_loses_the_dpa(self):
        self.recruiter.dpa_accepted_at = None
        self.recruiter.save(update_fields=['dpa_accepted_at', 'updated_at'])

        with self.assertRaises(ApplicationNotAllowed):
            create_application_record(candidate=self.candidate, job=self.job, cv=self.cv)

    def test_public_job_of_an_employer_with_data_access_takes_applications(self):
        application = create_application_record(candidate=self.candidate, job=self.job, cv=self.cv)

        self.assertEqual(application.job, self.job)


class StoppedJobDetailTests(TestCase):
    def setUp(self):
        employer = get_user_model().objects.create_user(
            email='stopped-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Stopped Co', created_by=employer)
        self.recruiter = make_employer_ready(employer, company=company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Stopped job',
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

    def detail(self):
        return self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

    def test_open_job_takes_applications(self):
        response = self.detail()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['accepting_applications'])
        self.assertIsNone(response.data['stopped_at'])

    def test_closed_job_stays_readable_but_stopped(self):
        closed_at = timezone.now()
        Job.objects.filter(pk=self.job.pk).update(status=Job.Status.CLOSED, closed_at=closed_at)

        response = self.detail()

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['accepting_applications'])
        self.assertIsNotNone(response.data['stopped_at'])

    def test_expired_job_reports_when_its_deadline_ended(self):
        Job.objects.filter(pk=self.job.pk).update(deadline=vietnam_today() - timedelta(days=2))

        response = self.detail()

        self.assertFalse(response.data['accepting_applications'])
        self.job.refresh_from_db()
        self.assertEqual(
            self.job.stopped_at, vietnam_day_start(vietnam_today() - timedelta(days=1))
        )

    def test_held_job_is_not_readable(self):
        Job.objects.filter(pk=self.job.pk).update(
            status=Job.Status.CLOSED, moderation_hold=Job.ModerationHold.MANUAL_REVIEW
        )

        self.assertEqual(self.detail().status_code, 404)
