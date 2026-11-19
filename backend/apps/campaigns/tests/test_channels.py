from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.applications.models import Application
from apps.applications.tests import test_candidate_api
from apps.campaigns.models import RecruitmentCampaign
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.jobs.models import Job
from apps.jobs.tests.factories import JobPostingFixture
from common.vietnam_time import vietnam_today

from ..models import CampaignChannel, CampaignChannelClickDaily
from ..services import resolve_campaign_attribution
from ..services.tracking import sign_ref

Status = RecruitmentCampaign.Status
SHELL = '<!doctype html><html lang="en"><head><title data-seo-default>Old</title></head><body></body></html>'
BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130'


class ChannelTestMixin(JobPostingFixture):
    def setUp(self):
        cache.clear()
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Tuyển kỹ thuật quý 1',
            status=Status.ACTIVE,
            target_date=vietnam_today() + timedelta(days=60),
            budget_max=10_000_000,
        )

    def channels_url(self, campaign=None):
        return reverse(
            'employer-campaign-channels',
            kwargs={'public_id': (campaign or self.campaign).public_id},
        )

    def channel_url(self, name, channel, **extra):
        return reverse(
            name,
            kwargs={'public_id': self.campaign.public_id, 'channel_id': channel.public_id, **extra},
        )

    def add_channel(self, **data):
        payload = {'kind': 'facebook_group', 'label': 'Nhóm IT Hà Nội', **data}
        response = self.client.post(self.channels_url(), payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return CampaignChannel.objects.get(public_id=response.data['public_id'])


class CampaignChannelApiTests(ChannelTestMixin, TestCase):
    def test_channels_get_tracked_links_and_validate_their_target(self):
        foreign_job = self.make_active_job()
        channel = self.add_channel()

        listed = self.client.get(self.channels_url())
        duplicate = self.client.post(
            self.channels_url(), {'kind': 'zalo', 'label': 'nhóm it hà nội'}, format='json'
        )
        foreign_target = self.client.post(
            self.channels_url(),
            {'kind': 'zalo', 'label': 'Zalo', 'target': 'job', 'job': foreign_job.public_id},
            format='json',
        )

        self.assertEqual(
            listed.data[0]['link'], f'{settings.FRONTEND_URL.rstrip("/")}/r/{channel.code}'
        )
        self.assertEqual(listed.data[0]['clicks'], 0)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(foreign_target.status_code, 400)
        self.assertIn('job', foreign_target.data)
        self.assertTrue(self.campaign.activities.filter(event_type='channel_added').exists())

    def test_marking_posted_and_editing_content(self):
        channel = self.add_channel()

        posted = self.client.patch(
            self.channel_url('employer-campaign-channel-detail', channel),
            {
                'posted': True,
                'posted_url': 'https://facebook.com/groups/it/posts/1',
                'content': {
                    'headline': 'Tuyển',
                    'body': 'Ứng tuyển tại {link}',
                    'hashtags': ['it'],
                },
            },
            format='json',
        )

        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertIsNotNone(posted.data['posted_at'])
        self.assertEqual(posted.data['content_source'], 'manual')
        self.assertEqual(
            posted.data['rendered_content']['body'],
            f'Ứng tuyển tại {settings.FRONTEND_URL.rstrip("/")}/r/{channel.code}',
        )

    @override_settings(AI_RUNTIME_ENABLED=False)
    def test_content_falls_back_to_the_template_when_ai_is_off(self):
        self.make_active_job(campaign=self.campaign)
        channel = self.add_channel()

        response = self.client.post(self.channel_url('employer-campaign-channel-content', channel))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['fallback_reason'], 'ai_disabled')
        self.assertEqual(response.data['content_source'], 'template')
        self.assertIn('Backend Engineer', response.data['content']['body'])
        self.assertIn('{link}', response.data['content']['body'])

    def test_report_compares_channels_costs_and_organic_sources(self):
        job = self.make_active_job(campaign=self.campaign)
        channel = self.add_channel()
        self.client.post(
            self.channel_url('employer-campaign-channel-costs', channel),
            {'amount': 2_000_000, 'incurred_on': vietnam_today().isoformat()},
            format='json',
        )
        CampaignChannelClickDaily.objects.create(
            channel=channel, date=vietnam_today(), click_count=12, unique_click_count=10
        )
        candidates = [self.make_candidate(f'cand{i}@example.com') for i in range(3)]
        for index, candidate in enumerate(candidates):
            cv = UserCv.objects.create(user=candidate, title='CV')
            Application.objects.create(
                candidate=candidate,
                job=job,
                cv=cv,
                submitted_cv_version=create_initial_document(cv, candidate),
                campaign_channel=channel if index < 2 else None,
                acquisition_channel=channel.kind if index < 2 else '',
                status=Application.Status.ACCEPTED if index == 0 else Application.Status.SUBMITTED,
            )

        report = self.client.get(
            reverse(
                'employer-campaign-channel-report', kwargs={'public_id': self.campaign.public_id}
            )
        ).data

        row = report['rows'][0]
        self.assertEqual(
            {k: row[k] for k in ('clicks', 'unique_clicks', 'applications', 'hires', 'cost')},
            {'clicks': 12, 'unique_clicks': 10, 'applications': 2, 'hires': 1, 'cost': 2_000_000},
        )
        self.assertEqual(row['apply_rate'], 20.0)
        self.assertEqual(row['cost_per_application'], 1_000_000)
        self.assertEqual(row['cost_per_hire'], 2_000_000)
        organic = next(r for r in report['rows'] if r['key'] == 'organic:applied')
        self.assertEqual(organic['applications'], 1)
        self.assertEqual(report['totals']['budget_used_percent'], 20.0)

    def make_candidate(self, email):
        from django.contrib.auth import get_user_model

        return get_user_model().objects.create_user(
            email=email, password='password', role='candidate'
        )


class TrackedLinkRedirectTests(ChannelTestMixin, TestCase):
    def click(self, channel, agent=BROWSER, method='get'):
        return getattr(self.client, method)(f'/r/{channel.code}', HTTP_USER_AGENT=agent)

    def test_redirect_counts_clicks_once_per_visitor_and_previews_apart(self):
        channel = self.add_channel()

        first = self.click(channel)
        self.click(channel)
        self.click(channel, agent='facebookexternalhit/1.1')

        self.assertEqual(first.status_code, 302)
        self.assertTrue(first['Location'].startswith(f'/tuyen-dung/{self.campaign.slug}?ref='))
        self.assertEqual(first['Cache-Control'], 'no-store')
        day = CampaignChannelClickDaily.objects.get(channel=channel)
        self.assertEqual(
            (day.click_count, day.unique_click_count, day.preview_count, day.inactive_click_count),
            (2, 1, 1, 0),
        )

    def test_job_target_goes_to_the_job_only_while_the_campaign_runs(self):
        job = self.make_active_job(campaign=self.campaign)
        Job.objects.filter(pk=job.pk).update(slug='backend-engineer-x')
        channel = self.add_channel(target='job', job=job.public_id)

        live = self.click(channel)
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(status=Status.PAUSED)
        paused = self.click(channel)

        self.assertTrue(live['Location'].startswith('/viec-lam/backend-engineer-x?ref='))
        self.assertTrue(paused['Location'].startswith(f'/tuyen-dung/{self.campaign.slug}?ref='))
        self.assertEqual(
            CampaignChannelClickDaily.objects.get(channel=channel).inactive_click_count, 1
        )

    def test_unknown_code_is_not_found(self):
        self.assertEqual(self.client.get('/r/nothing1').status_code, 404)

    def test_ref_resolves_only_for_its_own_campaign_and_when_untampered(self):
        job = self.make_active_job(campaign=self.campaign)
        other_job = self.make_active_job()
        channel = self.add_channel()
        ref = sign_ref(channel.code)

        self.assertEqual(resolve_campaign_attribution(job=job, ref=ref), channel)
        self.assertIsNone(resolve_campaign_attribution(job=job, ref=f'{ref}x'))
        self.assertIsNone(resolve_campaign_attribution(job=other_job, ref=ref))
        self.assertIsNone(resolve_campaign_attribution(job=job, ref=''))


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class CampaignLandingTests(ChannelTestMixin, TestCase):
    def test_landing_api_and_seo_shell_follow_the_campaign_state(self):
        self.client.force_authenticate(None)
        draft = RecruitmentCampaign.objects.create(
            owner=self.recruiter, company=self.company, name='Draft'
        )

        open_page = self.client.get(
            reverse('campaign-landing', kwargs={'slug': self.campaign.slug})
        )
        open_shell = self.client.get(f'/tuyen-dung/{self.campaign.slug}')
        draft_page = self.client.get(reverse('campaign-landing', kwargs={'slug': draft.slug}))
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(status=Status.COMPLETED)
        ended_page = self.client.get(
            reverse('campaign-landing', kwargs={'slug': self.campaign.slug})
        )
        ended_shell = self.client.get(f'/tuyen-dung/{self.campaign.slug}')

        self.assertEqual(open_page.status_code, 200, open_page.data)
        self.assertEqual(open_page.data['state'], 'open')
        self.assertEqual(open_page.data['company']['name'], self.company.company_name)
        self.assertEqual(open_shell.status_code, 200)
        self.assertIn('Tuyển kỹ thuật quý 1', open_shell.content.decode())
        self.assertEqual(draft_page.status_code, 404)
        self.assertEqual(ended_page.data['state'], 'ended')
        self.assertEqual(ended_shell.status_code, 410)
        self.assertEqual(ended_shell['X-Robots-Tag'], 'noindex')

    def test_public_job_list_filters_by_campaign(self):
        in_campaign = self.make_active_job(campaign=self.campaign)
        self.make_active_job()

        response = self.client.get(reverse('job-list'), {'campaign': self.campaign.public_id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [job['public_id'] for job in response.data['results']], [in_campaign.public_id]
        )


class ApplyAttributionTests(TestCase):
    setUp_application = test_candidate_api.CandidateApplicationTests.setUp
    apply_payload = test_candidate_api.CandidateApplicationTests.apply_payload

    def setUp(self):
        self.setUp_application()
        self.client = APIClient()
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.employer.recruiter_profile,
            company=self.company,
            name='Đợt tuyển',
            status=Status.ACTIVE,
        )
        Job.objects.filter(pk=self.job.pk).update(campaign=self.campaign)
        self.channel = CampaignChannel.objects.create(
            campaign=self.campaign, kind='linkedin', label='LinkedIn công ty'
        )

    def test_application_with_a_valid_ref_is_credited_to_the_channel(self):
        self.client.force_authenticate(self.candidate)

        response = self.client.post(
            reverse('candidate-application-list-create'),
            self.apply_payload(campaign_ref=sign_ref(self.channel.code)),
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        application = Application.objects.get(public_id=response.data['public_id'])
        self.assertEqual(application.campaign_channel, self.channel)
        self.assertEqual(application.acquisition_channel, 'linkedin')

    def test_a_tampered_ref_never_blocks_applying(self):
        self.client.force_authenticate(self.candidate)

        response = self.client.post(
            reverse('candidate-application-list-create'),
            self.apply_payload(campaign_ref='forged:value'),
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(
            Application.objects.get(public_id=response.data['public_id']).campaign_channel
        )
