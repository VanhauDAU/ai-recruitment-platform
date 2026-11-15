"""Invite-a-reviewer links: token handling, de-identification and scorecards."""

from datetime import timedelta
from urllib.parse import urlsplit

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.accounts.services.tokens import issue_tokens
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.models import CvAccessLog
from apps.cvs.services import create_application_snapshot, create_v2_cv
from apps.employers.models import Company, EmployerNotification
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.helpers import open_visibility_window

from ..models import Application, ApplicationReviewLink
from ..services import deidentified_content


class ApplicationReviewLinkTests(APITestCase):
    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='review-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.employer = users.create_user(
            email='review-employer@example.com', password='password', role='employer'
        )
        self.outsider = users.create_user(
            email='review-outsider@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Review Co', created_by=self.employer)
        make_employer_ready(self.employer, company=company, candidate_data=True)
        other = Company.objects.create(company_name='Other Review Co', created_by=self.outsider)
        make_employer_ready(self.outsider, company=other, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Data Engineer',
            description='d',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        template, _version = make_published_template('Review template')
        cv = create_v2_cv(actor=self.candidate, title='Review CV', template=template)
        fill_cv_for_application(cv, self.candidate, full_name='Trần Bình', email='binh@example.com')
        self.application = Application.objects.create(
            candidate=self.candidate,
            job=self.job,
            cv=cv,
            submitted_cv_version=create_application_snapshot(cv, self.candidate),
            submitted_cv_title=cv.title,
            submitted_cv_source=cv.source,
        )
        self.login(self.employer)

    def login(self, user):
        tokens = issue_tokens(user, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def url(self, name, *args):
        return reverse(name, args=[self.application.public_id, *args])

    def create_link(self, **payload):
        response = self.client.post(
            self.url('recruiter-application-review-links-v2'),
            {'reviewer_name': 'Anh Giám đốc', 'message': 'Xem giúp em', **payload},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        token = urlsplit(response.data['url']).path.rsplit('/', 1)[-1]
        return response.data['link'], token

    def public(self):
        return APIClient()

    def test_token_is_returned_once_and_only_its_hash_is_stored(self):
        link, token = self.create_link()

        stored = ApplicationReviewLink.objects.get(public_id=link['public_id'])
        self.assertNotEqual(stored.token_hash, token)
        self.assertEqual(len(stored.token_hash), 64)
        listing = self.client.get(self.url('recruiter-application-review-links-v2'))
        self.assertNotIn(token, str(listing.data))
        self.assertEqual(listing.data[0]['status'], 'active')

    def test_reviewer_sees_a_deidentified_cv_and_the_read_is_audited(self):
        _link, token = self.create_link()

        response = self.public().get(reverse('public-application-review-v2', args=[token]))

        self.assertEqual(response.status_code, 200, response.data)
        personal = response.data['cv']['content_json']['personal_info']
        self.assertEqual(personal['full_name'], 'Trần Bình')
        self.assertEqual((personal['email'], personal['avatar_asset_id']), ('', None))
        self.assertEqual(response.data['job_title'], 'Data Engineer')
        self.assertTrue(
            CvAccessLog.objects.filter(
                actor_type=CvAccessLog.ActorType.ANONYMOUS,
                access_channel=CvAccessLog.AccessChannel.SHARED_LINK,
            ).exists()
        )

    def test_referees_and_contacts_are_removed(self):
        content = deidentified_content(
            {
                'personal_info': {'phone': '0909', 'links': [{'url': 'x'}], 'avatar_asset_id': 'a'},
                'sections': [{'section_key': 'references'}, {'section_key': 'skills'}],
            }
        )

        self.assertEqual(content['personal_info']['phone'], '')
        self.assertEqual(content['personal_info']['links'], [])
        self.assertEqual([s['section_key'] for s in content['sections']], ['skills'])

    def test_scorecard_notifies_the_recruiter_once_and_can_be_edited(self):
        _link, token = self.create_link()
        url = reverse('public-application-review-v2', args=[token])

        first = self.public().put(url, {'recommendation': 'yes', 'rating': 4}, format='json')
        second = self.public().put(
            url,
            {'recommendation': 'strong_yes', 'rating': 5, 'strengths': 'SQL tốt'},
            format='json',
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.data['recommendation'], 'strong_yes')
        notices = EmployerNotification.objects.filter(
            recipient=self.employer,
            event_type=EmployerNotification.EventType.APPLICATION_REVIEW_SUBMITTED,
        )
        self.assertEqual(notices.count(), 1)
        self.assertIn(f'application={self.application.public_id}', notices.get().action_path)
        reviews = self.client.get(self.url('recruiter-application-reviews-v2'))
        self.assertEqual(reviews.data['summary']['total'], 1)
        self.assertEqual(reviews.data['summary']['by_recommendation']['strong_yes'], 1)
        self.assertEqual(reviews.data['summary']['average_rating'], 5)

    def test_revoked_expired_and_unknown_links_look_the_same(self):
        link, token = self.create_link()
        _other, expired_token = self.create_link()
        ApplicationReviewLink.objects.exclude(public_id=link['public_id']).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        self.client.post(self.url('recruiter-application-review-link-revoke-v2', link['public_id']))

        for raw in (token, expired_token, 'not-a-token'):
            with self.subTest(raw=raw[:6]):
                response = self.public().get(reverse('public-application-review-v2', args=[raw]))
                self.assertEqual(response.status_code, 404)

    def test_links_are_private_to_the_job_poster(self):
        self.login(self.outsider)

        self.assertEqual(
            self.client.post(
                self.url('recruiter-application-review-links-v2'),
                {'reviewer_name': 'X'},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(self.url('recruiter-application-reviews-v2')).status_code, 404
        )
