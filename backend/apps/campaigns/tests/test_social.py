from dataclasses import replace
from datetime import timedelta
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import requests
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.campaigns.models import RecruitmentCampaign
from apps.employers.models import EmployerNotification
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.tests.factories import JobPostingFixture
from common.vietnam_time import vietnam_today

from ..domain.social_networks import NETWORKS
from ..models import CampaignChannel, ScheduledSocialPost, SocialAccountConnection
from ..services import publish_post, reconcile_social_posts, schedule_post
from ..services.social import SocialProviderError, decrypt_token
from ..services.social.facebook import FacebookPageProvider

Status = RecruitmentCampaign.Status
Post = ScheduledSocialPost


class SocialFixtures(JobPostingFixture):
    def setUp(self):
        cache.clear()
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Tuyển kỹ thuật',
            status=Status.ACTIVE,
            target_date=vietnam_today() + timedelta(days=30),
        )
        self.channel = CampaignChannel.objects.create(
            campaign=self.campaign,
            kind=CampaignChannel.Kind.FACEBOOK_PAGE,
            label='Fanpage công ty',
            content={
                'headline': 'Tuyển gấp',
                'body': 'Ứng tuyển: {link}',
                'hashtags': ['tuyendung'],
            },
        )

    def authorize(self, network='facebook_page'):
        start = self.client.post(reverse('employer-social-authorize', kwargs={'network': network}))
        return parse_qs(urlparse(start.data['url']).query)

    def connect_page(self):
        query = self.authorize()
        # The fake provider sends the browser to the redirect URI registered with Meta.
        redirected = self.client.get(
            reverse('employer-social-facebook-callback'),
            {'code': query['code'][0], 'state': query['state'][0]},
        )
        nonce = parse_qs(urlparse(redirected['Location']).query)['social_select'][0]
        selected = self.client.post(
            reverse('employer-social-pending', kwargs={'network': 'facebook_page', 'nonce': nonce}),
            {'account_id': 'fake-facebook_page-1'},
            format='json',
        )
        return SocialAccountConnection.objects.get(public_id=selected.data['public_id'])


class SocialConnectionTests(SocialFixtures, TestCase):
    def test_fake_oauth_flow_stores_only_an_encrypted_account_token(self):
        connection = self.connect_page()

        listed = self.client.get(reverse('employer-social-connections'))

        self.assertEqual(connection.status, SocialAccountConnection.Status.CONNECTED)
        self.assertEqual((connection.network, connection.simulated), ('facebook_page', True))
        self.assertNotIn('fake-account-token', connection.token_ciphertext)
        self.assertEqual(decrypt_token(connection.token_ciphertext), 'fake-account-token')
        self.assertEqual(listed.data[0]['network_label'], 'Fanpage Facebook')
        self.assertTrue(listed.data[0]['simulated'])
        self.assertNotIn('token_ciphertext', listed.data[0])

    def test_state_is_single_use_tamper_proof_and_bound_to_its_network(self):
        state = self.authorize()['state'][0]
        url = reverse('employer-social-callback', kwargs={'network': 'facebook_page'})

        first = self.client.get(url, {'code': 'fake-code', 'state': state})
        replay = self.client.get(url, {'code': 'fake-code', 'state': state})
        forged = self.client.get(url, {'code': 'fake-code', 'state': f'{state}x'})
        denied = self.client.get(url, {'state': state})

        self.assertIn('social_select=', first['Location'])
        self.assertIn('network=facebook_page', first['Location'])
        self.assertIn('social_error=expired', replay['Location'])
        self.assertIn('social_error=expired', forged['Location'])
        self.assertIn('social_error=denied', denied['Location'])

    def test_unknown_networks_are_not_found(self):
        response = self.client.post(
            reverse('employer-social-authorize', kwargs={'network': 'myspace'})
        )

        self.assertEqual(response.status_code, 404)

    def test_networks_list_their_limits_and_whether_they_are_simulated(self):
        response = self.client.get(reverse('employer-social-networks'))

        facebook = next(item for item in response.data if item['key'] == 'facebook_page')
        self.assertEqual(facebook['channel_kind'], 'facebook_page')
        self.assertEqual(facebook['capabilities']['max_images'], 4)
        self.assertTrue(facebook['simulated'])
        with override_settings(CAMPAIGN_SOCIAL_LIVE_NETWORKS=['facebook_page']):
            live = self.client.get(reverse('employer-social-networks')).data
        self.assertFalse(live[0]['simulated'])

    def test_disconnect_cancels_pending_posts(self):
        connection = self.connect_page()
        post = schedule_post(channel=self.channel, user=self.user, connection=connection)

        response = self.client.delete(
            reverse(
                'employer-social-connection-detail', kwargs={'connection_id': connection.public_id}
            )
        )

        self.assertEqual(response.status_code, 204)
        post.refresh_from_db()
        self.assertEqual(post.status, Post.Status.CANCELLED)


class SocialPostingTests(SocialFixtures, TestCase):
    def setUp(self):
        super().setUp()
        self.connection = self.connect_page()

    def schedule(self, **kwargs):
        return schedule_post(
            channel=self.channel, user=self.user, connection=self.connection, **kwargs
        )

    def test_api_schedules_with_rendered_content_and_publishing_marks_the_channel_posted(self):
        response = self.client.post(
            reverse(
                'employer-campaign-channel-posts',
                kwargs={'public_id': self.campaign.public_id, 'channel_id': self.channel.public_id},
            ),
            {'connection': self.connection.public_id},
            format='json',
        )
        post = Post.objects.get(public_id=response.data['public_id'])

        self.assertIn(f'/r/{self.channel.code}', post.message)
        self.assertIn('#tuyendung', post.message)
        self.assertEqual(publish_post(post.pk), Post.Status.PUBLISHED)
        post.refresh_from_db()
        self.channel.refresh_from_db()
        self.assertTrue(post.external_post_id.startswith('fake-facebook_page-1_'))
        self.assertIsNotNone(self.channel.posted_at)
        self.assertTrue(
            self.campaign.activities.filter(event_type='social_post_published').exists()
        )

    def test_only_channels_of_the_connection_network_and_future_times_are_accepted(self):
        other = CampaignChannel.objects.create(campaign=self.campaign, kind='zalo', label='Zalo')

        with self.assertRaises(ValidationError):
            schedule_post(channel=other, user=self.user, connection=self.connection)
        with self.assertRaises(ValidationError):
            self.schedule(scheduled_for=timezone.now() - timedelta(hours=1))

    def test_posts_must_fit_the_network_limits(self):
        limits = NETWORKS['facebook_page'].capabilities
        strict = replace(NETWORKS['facebook_page'], capabilities=replace(limits, max_chars=10))

        with patch.dict(NETWORKS, {'facebook_page': strict}):
            with self.assertRaises(ValidationError) as raised:
                self.schedule(message='Nội dung dài hơn mười ký tự')

        self.assertIn('10 ký tự', str(raised.exception.detail['message']))

    def test_paused_campaign_postpones_and_resuming_brings_future_posts_back(self):
        due = self.schedule()
        later = self.schedule(scheduled_for=timezone.now() + timedelta(hours=2))
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(status=Status.PAUSED)

        publish_post(due.pk)
        reconcile_social_posts()
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(status=Status.ACTIVE)
        reconcile_social_posts()

        due.refresh_from_db()
        later.refresh_from_db()
        self.assertEqual(due.status, Post.Status.POSTPONED)
        self.assertEqual(later.status, Post.Status.SCHEDULED)

    def test_ending_the_campaign_removes_published_posts_and_cancels_the_rest(self):
        published = self.schedule()
        publish_post(published.pk)
        pending = self.schedule(scheduled_for=timezone.now() + timedelta(hours=1))
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(status=Status.COMPLETED)

        reconcile_social_posts()

        published.refresh_from_db()
        pending.refresh_from_db()
        self.assertEqual(published.status, Post.Status.DELETED)
        self.assertEqual(pending.status, Post.Status.CANCELLED)

    def test_a_network_that_cannot_delete_leaves_the_post_to_the_recruiter(self):
        published = self.schedule()
        publish_post(published.pk)
        spec = NETWORKS['facebook_page']
        keeps_posts = replace(spec, capabilities=replace(spec.capabilities, supports_delete=False))
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(status=Status.COMPLETED)

        with (
            patch.dict(NETWORKS, {'facebook_page': keeps_posts}),
            patch('apps.campaigns.services.social_posts.get_provider') as provider,
        ):
            reconcile_social_posts()

        published.refresh_from_db()
        provider.return_value.delete.assert_not_called()
        self.assertEqual(
            (published.status, published.last_error_code),
            (Post.Status.DELETE_FAILED, 'delete_unsupported'),
        )
        notice = EmployerNotification.objects.get(
            event_type=EmployerNotification.EventType.SOCIAL_POST_DELETE_FAILED
        )
        self.assertIn(published.permalink, notice.message)

    def test_transient_errors_retry_and_token_errors_expire_the_connection(self):
        flaky = self.schedule()
        broken = self.schedule()
        failing = MagicMock()
        failing.publish.side_effect = SocialProviderError('timeout', transient=True)
        failing.find_recent_post.return_value = None

        with patch('apps.campaigns.services.social_posts.get_provider', return_value=failing):
            publish_post(flaky.pk)
        failing.publish.side_effect = SocialProviderError('graph_190', token_invalid=True)
        with patch('apps.campaigns.services.social_posts.get_provider', return_value=failing):
            publish_post(broken.pk)

        flaky.refresh_from_db()
        broken.refresh_from_db()
        self.connection.refresh_from_db()
        self.assertEqual(flaky.status, Post.Status.SCHEDULED)
        self.assertIsNotNone(flaky.next_attempt_at)
        self.assertEqual(broken.status, Post.Status.FAILED)
        self.assertEqual(self.connection.status, SocialAccountConnection.Status.EXPIRED)
        self.assertTrue(
            EmployerNotification.objects.filter(
                event_type=EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRED
            ).exists()
        )

    def test_a_handover_cancels_posts_on_the_previous_owner_page(self):
        post = self.schedule()
        new_owner = make_employer_ready(self.other_user, company=self.company, candidate_data=True)
        RecruitmentCampaign.objects.filter(pk=self.campaign.pk).update(owner=new_owner)

        publish_post(post.pk)

        post.refresh_from_db()
        self.assertEqual(
            (post.status, post.last_error_code), (Post.Status.CANCELLED, 'owner_changed')
        )


@override_settings(FACEBOOK_APP_ID='app', FACEBOOK_APP_SECRET='secret')
class FacebookProviderTests(TestCase):
    def response(self, status, payload):
        response = MagicMock(status_code=status)
        response.json.return_value = payload
        return response

    def test_publish_signs_requests_and_reads_the_permalink(self):
        session = MagicMock()
        session.request.side_effect = [
            self.response(200, {'id': 'page_1_post'}),
            self.response(200, {'permalink_url': 'https://fb.com/p/1'}),
        ]

        published = FacebookPageProvider(session=session).publish(
            account_id='page_1', token='token', message='Hi', link='https://procv.vn/r/a'
        )

        self.assertEqual(
            (published.post_id, published.permalink), ('page_1_post', 'https://fb.com/p/1')
        )
        params = session.request.call_args_list[0].kwargs['params']
        self.assertIn('appsecret_proof', params)
        self.assertEqual(
            session.request.call_args_list[0].args[1],
            'https://graph.facebook.com/v21.0/page_1/feed',
        )
        self.assertEqual(
            session.request.call_args_list[0].kwargs['data'],
            {'message': 'Hi', 'link': 'https://procv.vn/r/a'},
        )

    def test_a_link_facebook_cannot_reach_goes_into_the_text_instead(self):
        session = MagicMock()
        session.request.side_effect = [
            self.response(200, {'id': 'page_1_post'}),
            self.response(200, {'permalink_url': ''}),
        ] * 3

        provider = FacebookPageProvider(session=session)
        for link in ['http://localhost:5173/r/a', 'http://192.168.1.5/r/a', 'http://x/r/a']:
            provider.publish(account_id='page_1', token='t', message='Tuyển dụng', link=link)
        provider.session.request.side_effect = [
            self.response(200, {'id': 'p'}),
            self.response(200, {}),
        ]
        provider.publish(
            account_id='page_1',
            token='t',
            message='Ứng tuyển: http://localhost/r/b',
            link='http://localhost/r/b',
        )

        sent = [c.kwargs['data'] for c in session.request.call_args_list if c.args[0] == 'POST']
        self.assertEqual(sent[0], {'message': 'Tuyển dụng\n\nhttp://localhost:5173/r/a'})
        self.assertEqual(sent[1], {'message': 'Tuyển dụng\n\nhttp://192.168.1.5/r/a'})
        self.assertNotIn('link', sent[2])
        self.assertEqual(sent[3], {'message': 'Ứng tuyển: http://localhost/r/b'})

    def test_errors_are_classified(self):
        provider = FacebookPageProvider(session=MagicMock())
        cases = [
            (
                self.response(400, {'error': {'code': 190}}),
                {'token_invalid': True, 'transient': False},
            ),
            (
                self.response(400, {'error': {'code': 4}}),
                {'token_invalid': False, 'transient': True},
            ),
            (self.response(503, {}), {'token_invalid': False, 'transient': True}),
            (
                self.response(400, {'error': {'code': 368}}),
                {'token_invalid': False, 'transient': False},
            ),
        ]
        for response, expected in cases:
            provider.session.request.side_effect = [response]
            with self.assertRaises(SocialProviderError) as raised:
                provider.publish(account_id='p', token='t', message='m', link='l')
            self.assertEqual(
                {
                    'token_invalid': raised.exception.token_invalid,
                    'transient': raised.exception.transient,
                },
                expected,
            )
        provider.session.request.side_effect = requests.Timeout()
        with self.assertRaises(SocialProviderError) as raised:
            provider.publish(account_id='p', token='t', message='m', link='l')
        self.assertTrue(raised.exception.transient)


class PostErrorMessageTests(TestCase):
    def test_failures_are_explained_in_words_a_recruiter_can_act_on(self):
        from ..api.serializers.social import ScheduledPostSerializer

        def message(code):
            return ScheduledPostSerializer().get_error_message(Post(last_error_code=code))

        self.assertIn('không phải localhost', message('graph_1500'))
        self.assertIn('kết nối lại', message('graph_190'))
        facebook = SocialAccountConnection(network='facebook_page')
        failed = Post(connection=facebook, last_error_code='graph_999')
        self.assertEqual(
            ScheduledPostSerializer().get_error_message(failed),
            'Facebook báo lỗi (graph_999). Hãy thử đăng lại.',
        )
        self.assertEqual(message(''), '')


def image_upload(name='anh.png', size=(3000, 1500), mode='RGB', fmt='PNG'):
    from io import BytesIO

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    buffer = BytesIO()
    Image.new(mode, size, (12, 120, 90)).save(buffer, format=fmt)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f'image/{fmt.lower()}')


class PostImageTests(SocialFixtures, TestCase):
    def setUp(self):
        super().setUp()
        self.connection = self.connect_page()
        self.url = reverse(
            'employer-campaign-channel-post-images',
            kwargs={'public_id': self.campaign.public_id, 'channel_id': self.channel.public_id},
        )

    def test_uploads_are_re_encoded_resized_and_kept_under_the_campaign(self):
        from PIL import Image

        from common.storage.r2 import public_media_storage

        response = self.client.post(self.url, {'file': image_upload()}, format='multipart')

        self.assertEqual(response.status_code, 201, response.data)
        path = response.data['path']
        self.assertTrue(path.startswith(f'campaigns/{self.campaign.public_id}/social/'))
        self.assertTrue(path.endswith('.jpg'))
        with public_media_storage().open(path, 'rb') as stored, Image.open(stored) as image:
            self.assertEqual(max(image.size), 2048)
            self.assertNotIn('exif', image.info)

    def test_rejects_files_that_are_not_images(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        fake = SimpleUploadedFile('a.png', b'%PDF-1.7 not an image', content_type='image/png')
        response = self.client.post(self.url, {'file': fake}, format='multipart')

        self.assertEqual(response.status_code, 400)

    def test_a_post_carries_its_own_images_and_publishes_them(self):
        uploaded = self.client.post(self.url, {'file': image_upload()}, format='multipart').data
        posts_url = reverse(
            'employer-campaign-channel-posts',
            kwargs={'public_id': self.campaign.public_id, 'channel_id': self.channel.public_id},
        )

        foreign = self.client.post(
            posts_url,
            {'connection': self.connection.public_id, 'images': ['campaigns/other/social/x.jpg']},
            format='json',
        )
        created = self.client.post(
            posts_url,
            {'connection': self.connection.public_id, 'images': [uploaded['path']]},
            format='json',
        )

        self.assertEqual(foreign.status_code, 400)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(len(created.data['images']), 1)
        post = Post.objects.get(public_id=created.data['public_id'])
        self.assertEqual(publish_post(post.pk), Post.Status.PUBLISHED)
        post.refresh_from_db()
        stored = cache.get(f'fake-social-post:{post.external_post_id}')
        self.assertEqual(len(stored['images']), 1)

    def test_company_cover_is_offered_and_accepted(self):
        from common.storage.r2 import public_media_storage

        path = public_media_storage().save(
            f'employers/{self.company.public_id}/covers/cover.jpg',
            image_upload(fmt='JPEG', size=(100, 50)),
        )
        self.company.cover_image_url = path
        self.company.save(update_fields=['cover_image_url'])

        offered = self.client.get(self.url).data['company_images']
        post = schedule_post(
            channel=self.channel, user=self.user, connection=self.connection, images=[path]
        )

        self.assertEqual([item['kind'] for item in offered], ['cover'])
        self.assertEqual(post.images, [path])


@override_settings(FACEBOOK_APP_ID='app', FACEBOOK_APP_SECRET='secret')
class FacebookPhotoPublishTests(TestCase):
    def test_photos_are_uploaded_unpublished_then_attached_to_one_post(self):
        import json as jsonlib

        session = MagicMock()

        def reply(payload):
            response = MagicMock(status_code=200)
            response.json.return_value = payload
            return response

        session.request.side_effect = [
            reply({'id': 'photo_1'}),
            reply({'id': 'photo_2'}),
            reply({'id': 'page_post'}),
            reply({'permalink_url': 'https://fb.com/p'}),
        ]

        FacebookPageProvider(session=session).publish(
            account_id='page_1',
            token='t',
            message='Tuyển gấp',
            link='https://procv.vn/r/a',
            images=[('a.jpg', b'1'), ('b.jpg', b'2')],
        )

        calls = session.request.call_args_list
        self.assertEqual(calls[0].args[1], 'https://graph.facebook.com/v21.0/page_1/photos')
        self.assertEqual(calls[0].kwargs['data'], {'published': 'false'})
        self.assertEqual(calls[0].kwargs['files'], {'source': ('a.jpg', b'1')})
        feed = calls[2].kwargs['data']
        self.assertEqual(feed['message'], 'Tuyển gấp\n\nhttps://procv.vn/r/a')
        self.assertNotIn('link', feed)
        self.assertEqual(jsonlib.loads(feed['attached_media[1]']), {'media_fbid': 'photo_2'})
