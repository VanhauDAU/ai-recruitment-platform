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
from ..services import publish_post, reconcile_social_posts, refresh_expiring_tokens, schedule_post
from ..services.social import PostImage, SocialProviderError, decrypt_token
from ..services.social.facebook import FacebookPageProvider
from ..services.social.instagram import InstagramProvider
from ..services.social.threads import ThreadsProvider
from ..services.social_post_images import _fit_ratio

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

    def test_posting_now_publishes_on_commit_without_waiting_for_the_beat(self):
        url = reverse(
            'employer-campaign-channel-posts',
            kwargs={'public_id': self.campaign.public_id, 'channel_id': self.channel.public_id},
        )
        later = (timezone.now() + timedelta(hours=1)).isoformat()

        with self.captureOnCommitCallbacks(execute=True):
            now = self.client.post(url, {'connection': self.connection.public_id}, format='json')
        with self.captureOnCommitCallbacks(execute=True) as scheduled:
            future = self.client.post(
                url,
                {'connection': self.connection.public_id, 'scheduled_for': later},
                format='json',
            )

        self.assertEqual(
            Post.objects.get(public_id=now.data['public_id']).status, Post.Status.PUBLISHED
        )
        self.assertEqual(
            Post.objects.get(public_id=future.data['public_id']).status, Post.Status.SCHEDULED
        )
        self.assertEqual(scheduled, [])

    def test_a_due_post_waiting_for_the_worker_reads_as_publishing(self):
        from ..api.serializers.social import ScheduledPostSerializer

        due = self.schedule()
        later = self.schedule(scheduled_for=timezone.now() + timedelta(hours=1))

        data = ScheduledPostSerializer([due, later], many=True).data

        self.assertEqual(
            [(item['queued'], item['status_label']) for item in data],
            [(True, 'Đang đăng'), (False, 'Đã hẹn giờ')],
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
            images=[
                PostImage('a.jpg', b'1', 'https://cdn/a.jpg'),
                PostImage('b.jpg', b'2', 'https://cdn/b.jpg'),
            ],
        )

        calls = session.request.call_args_list
        self.assertEqual(calls[0].args[1], 'https://graph.facebook.com/v21.0/page_1/photos')
        self.assertEqual(calls[0].kwargs['data'], {'published': 'false'})
        self.assertEqual(calls[0].kwargs['files'], {'source': ('a.jpg', b'1')})
        feed = calls[2].kwargs['data']
        self.assertEqual(feed['message'], 'Tuyển gấp\n\nhttps://procv.vn/r/a')
        self.assertNotIn('link', feed)
        self.assertEqual(jsonlib.loads(feed['attached_media[1]']), {'media_fbid': 'photo_2'})


class InstagramPostingTests(SocialFixtures, TestCase):
    def setUp(self):
        super().setUp()
        self.channel = CampaignChannel.objects.create(
            campaign=self.campaign,
            kind=CampaignChannel.Kind.INSTAGRAM,
            label='Instagram công ty',
            content={'headline': 'Tuyển gấp', 'body': 'Ứng tuyển: {link}'},
        )
        query = self.authorize('instagram')
        redirected = self.client.get(
            reverse('employer-social-callback', kwargs={'network': 'instagram'}),
            {'code': query['code'][0], 'state': query['state'][0]},
        )
        nonce = parse_qs(urlparse(redirected['Location']).query)['social_select'][0]
        selected = self.client.post(
            reverse('employer-social-pending', kwargs={'network': 'instagram', 'nonce': nonce}),
            {'account_id': 'fake-instagram-1'},
            format='json',
        )
        self.connection = SocialAccountConnection.objects.get(public_id=selected.data['public_id'])

    def test_a_post_needs_an_image_and_a_facebook_page_connection_does_not_fit(self):
        facebook_page = self.connect_page()

        with self.assertRaises(ValidationError) as missing:
            schedule_post(channel=self.channel, user=self.user, connection=self.connection)
        with self.assertRaises(ValidationError):
            schedule_post(channel=self.channel, user=self.user, connection=facebook_page)

        self.assertIn('Instagram cần ít nhất một ảnh', str(missing.exception.detail['images']))

    def test_images_are_sent_as_padded_jpeg_copies_kept_under_the_campaign(self):
        from common.storage.r2 import public_media_storage

        url = reverse(
            'employer-campaign-channel-post-images',
            kwargs={'public_id': self.campaign.public_id, 'channel_id': self.channel.public_id},
        )
        cover = self.client.post(
            url, {'file': image_upload(size=(3000, 1000))}, format='multipart'
        ).data
        post = schedule_post(
            channel=self.channel, user=self.user, connection=self.connection, images=[cover['path']]
        )

        self.assertEqual(publish_post(post.pk), Post.Status.PUBLISHED)
        post.refresh_from_db()
        sent = cache.get(f'fake-social-post:{post.external_post_id}')['images']
        fitted = f'campaigns/{self.campaign.public_id}/social/fit/{sent[0]}'
        self.assertTrue(sent[0].endswith('.jpg'))
        self.assertTrue(public_media_storage().exists(fitted))
        self.assertEqual(post.images, [cover['path']])


class ImageFitTests(TestCase):
    def test_images_outside_the_ratio_get_white_padding_and_become_rgb(self):
        from PIL import Image

        wide = _fit_ratio(Image.new('RGB', (3000, 1000), 'red'), (0.8, 1.91))
        tall = _fit_ratio(Image.new('RGBA', (400, 1000), (0, 0, 0, 0)), (0.8, 1.91))
        square = _fit_ratio(Image.new('RGB', (800, 800), 'red'), (0.8, 1.91))

        self.assertEqual(wide.width, 1440)
        self.assertAlmostEqual(wide.width / wide.height, 1.91, places=2)
        self.assertEqual(wide.getpixel((0, 0)), (255, 255, 255))
        self.assertEqual(tall.mode, 'RGB')
        self.assertEqual(tall.size, (800, 1000))
        self.assertEqual(tall.getpixel((400, 500)), (255, 255, 255))
        self.assertEqual(square.size, (800, 800))


@override_settings(FACEBOOK_APP_ID='app', FACEBOOK_APP_SECRET='secret')
class InstagramProviderTests(TestCase):
    def reply(self, payload, status=200):
        response = MagicMock(status_code=status)
        response.json.return_value = payload
        return response

    def provider(self, *replies):
        session = MagicMock()
        session.request.side_effect = [self.reply(payload) for payload in replies]
        self.sleep = MagicMock()
        return InstagramProvider(session=session, sleep=self.sleep), session

    def test_consent_asks_for_business_assets_so_linked_accounts_come_back(self):
        provider, _ = self.provider()

        scope = parse_qs(urlparse(provider.authorize_url('state')).query)['scope'][0]

        self.assertIn('business_management', scope.split(','))
        self.assertIn('instagram_content_publish', scope.split(','))

    def test_lists_only_pages_with_a_linked_instagram_account(self):
        provider, _ = self.provider(
            {
                'data': [
                    {
                        'id': 'page_1',
                        'name': 'Propos',
                        'access_token': 'page-token',
                        'instagram_business_account': {
                            'id': 'ig_1',
                            'username': 'propos.vn',
                            'profile_picture_url': 'https://cdn/p.jpg',
                        },
                    },
                    {'id': 'page_2', 'name': 'Không có IG', 'access_token': 't'},
                ]
            }
        )

        accounts = provider.list_accounts('user-token')

        self.assertEqual(
            [(a.account_id, a.name, a.token) for a in accounts],
            [('ig_1', '@propos.vn', 'page-token')],
        )

    def test_one_image_is_a_container_then_published_with_the_link_in_the_caption(self):
        provider, session = self.provider(
            {'id': 'container_1'},
            {'status_code': 'IN_PROGRESS'},
            {'status_code': 'FINISHED'},
            {'id': 'media_1'},
            {'permalink': 'https://instagram.com/p/1'},
        )

        published = provider.publish(
            account_id='ig_1',
            token='t',
            message='Tuyển gấp',
            link='https://procv.vn/r/a',
            images=[PostImage('a.jpg', b'1', 'https://cdn/a.jpg')],
        )

        calls = session.request.call_args_list
        self.assertEqual(calls[0].args[1], 'https://graph.facebook.com/v21.0/ig_1/media')
        self.assertEqual(
            calls[0].kwargs['data'],
            {'image_url': 'https://cdn/a.jpg', 'caption': 'Tuyển gấp\n\nhttps://procv.vn/r/a'},
        )
        self.assertEqual(calls[3].kwargs['data'], {'creation_id': 'container_1'})
        self.assertIn('appsecret_proof', calls[3].kwargs['params'])
        self.sleep.assert_called_once()
        self.assertEqual(
            (published.post_id, published.permalink), ('media_1', 'https://instagram.com/p/1')
        )

    def test_several_images_become_one_carousel(self):
        provider, session = self.provider(
            {'id': 'child_1'},
            {'status_code': 'FINISHED'},
            {'id': 'child_2'},
            {'status_code': 'FINISHED'},
            {'id': 'carousel'},
            {'status_code': 'FINISHED'},
            {'id': 'media_1'},
            {'permalink': ''},
        )

        provider.publish(
            account_id='ig_1',
            token='t',
            message='Ứng tuyển: https://procv.vn/r/a',
            link='https://procv.vn/r/a',
            images=[
                PostImage('a.jpg', b'1', 'https://cdn/a.jpg'),
                PostImage('b.jpg', b'2', 'https://cdn/b.jpg'),
            ],
        )

        posts = [c.kwargs['data'] for c in session.request.call_args_list if c.args[0] == 'POST']
        self.assertEqual(posts[0], {'image_url': 'https://cdn/a.jpg', 'is_carousel_item': 'true'})
        self.assertEqual(
            posts[2],
            {
                'media_type': 'CAROUSEL',
                'children': 'child_1,child_2',
                'caption': 'Ứng tuyển: https://procv.vn/r/a',
            },
        )
        self.assertEqual(posts[3], {'creation_id': 'carousel'})

    def test_container_failures_and_the_daily_limit_are_classified(self):
        failed, _ = self.provider({'id': 'c'}, {'status_code': 'ERROR'})
        slow, _ = self.provider({'id': 'c'}, *[{'status_code': 'IN_PROGRESS'}] * 5)
        limited, _ = self.provider({'error': {'code': 9}})
        image = [PostImage('a.jpg', b'1', 'https://cdn/a.jpg')]

        outcomes = []
        for provider in (failed, slow, limited):
            with self.assertRaises(SocialProviderError) as raised:
                provider.publish(account_id='ig', token='t', message='m', link='', images=image)
            outcomes.append((raised.exception.code, raised.exception.transient))
        with self.assertRaises(SocialProviderError) as no_image:
            failed.publish(account_id='ig', token='t', message='m', link='', images=[])

        self.assertEqual(
            outcomes,
            [
                ('container_error', False),
                ('container_pending', True),
                ('graph_9', True),
            ],
        )
        self.assertEqual(no_image.exception.code, 'image_required')

    def test_delete_removes_the_media_and_tolerates_one_already_gone(self):
        provider, session = self.provider({'success': True}, {'error': {'code': 100}})

        provider.delete(post_id='media_1', token='t')
        provider.delete(post_id='media_2', token='t')

        self.assertEqual(session.request.call_args_list[0].args[:2][0], 'DELETE')


class ThreadsConnectionTests(SocialFixtures, TestCase):
    def connect_threads(self):
        query = self.authorize('threads')
        redirected = self.client.get(
            reverse('employer-social-callback', kwargs={'network': 'threads'}),
            {'code': query['code'][0], 'state': query['state'][0]},
        )
        nonce = parse_qs(urlparse(redirected['Location']).query)['social_select'][0]
        selected = self.client.post(
            reverse('employer-social-pending', kwargs={'network': 'threads', 'nonce': nonce}),
            {'account_id': 'fake-threads-1'},
            format='json',
        )
        return SocialAccountConnection.objects.get(public_id=selected.data['public_id'])

    def test_a_threads_connection_keeps_its_token_expiry(self):
        connection = self.connect_threads()

        days = (connection.token_expires_at - timezone.now()).days
        self.assertIn(days, {59, 60})

    def test_tokens_close_to_expiry_are_refreshed_and_refused_ones_expire(self):
        soon = self.connect_threads()
        SocialAccountConnection.objects.filter(pk=soon.pk).update(
            token_expires_at=timezone.now() + timedelta(days=3)
        )
        lasting = self.connect_page()

        self.assertEqual(refresh_expiring_tokens(), 1)
        soon.refresh_from_db()
        lasting.refresh_from_db()
        self.assertGreater(soon.token_expires_at, timezone.now() + timedelta(days=50))
        self.assertIsNone(lasting.token_expires_at)

        SocialAccountConnection.objects.filter(pk=soon.pk).update(
            token_expires_at=timezone.now() + timedelta(days=3)
        )
        refused = MagicMock()
        refused.refresh.side_effect = SocialProviderError('graph_190', token_invalid=True)
        with patch('apps.campaigns.services.social_connections.get_provider', return_value=refused):
            refresh_expiring_tokens()

        soon.refresh_from_db()
        self.assertEqual(soon.status, SocialAccountConnection.Status.EXPIRED)
        notice = EmployerNotification.objects.get(
            event_type=EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRED
        )
        self.assertEqual(notice.action_path, '/tuyendung/app/account/settings/integrations')

    def test_a_transient_refresh_failure_leaves_the_connection_for_the_next_run(self):
        connection = self.connect_threads()
        SocialAccountConnection.objects.filter(pk=connection.pk).update(
            token_expires_at=timezone.now() + timedelta(days=3)
        )
        flaky = MagicMock()
        flaky.refresh.side_effect = SocialProviderError('timeout', transient=True)

        with patch('apps.campaigns.services.social_connections.get_provider', return_value=flaky):
            refresh_expiring_tokens()

        connection.refresh_from_db()
        self.assertEqual(connection.status, SocialAccountConnection.Status.CONNECTED)

    def test_threads_text_must_fit_500_characters_with_the_link(self):
        channel = CampaignChannel.objects.create(
            campaign=self.campaign, kind=CampaignChannel.Kind.THREADS, label='Threads'
        )
        connection = self.connect_threads()

        with self.assertRaises(ValidationError):
            schedule_post(channel=channel, user=self.user, connection=connection, message='a' * 480)
        post = schedule_post(
            channel=channel, user=self.user, connection=connection, message='Tuyển gấp'
        )

        self.assertEqual(publish_post(post.pk), Post.Status.PUBLISHED)


@override_settings(THREADS_APP_ID='threads-app', THREADS_APP_SECRET='threads-secret')
class ThreadsProviderTests(TestCase):
    def reply(self, payload, status=200):
        response = MagicMock(status_code=status)
        response.json.return_value = payload
        return response

    def provider(self, *replies):
        session = MagicMock()
        session.request.side_effect = [self.reply(payload) for payload in replies]
        self.sleep = MagicMock()
        return ThreadsProvider(session=session, sleep=self.sleep), session

    def test_login_and_token_exchange_use_threads_hosts(self):
        provider, session = self.provider(
            {'access_token': 'short', 'user_id': '1'},
            {'access_token': 'long', 'expires_in': 5184000},
        )

        url = urlparse(provider.authorize_url('state'))
        grant = provider.exchange_code('code')

        self.assertEqual(url.netloc, 'threads.com')
        self.assertIn('threads_delete', parse_qs(url.query)['scope'][0])
        calls = session.request.call_args_list
        self.assertEqual(calls[0].args[1], 'https://graph.threads.com/oauth/access_token')
        self.assertEqual(calls[0].kwargs['data']['grant_type'], 'authorization_code')
        self.assertEqual(calls[1].kwargs['params']['grant_type'], 'th_exchange_token')
        self.assertEqual(grant.token, 'long')
        self.assertGreater(grant.expires_at, timezone.now() + timedelta(days=59))

    def test_a_text_post_gets_a_link_card_and_no_appsecret_proof(self):
        provider, session = self.provider(
            {'id': 'container'},
            {'status': 'IN_PROGRESS'},
            {'status': 'FINISHED'},
            {'id': 'thread_1'},
            {'permalink': 'https://threads.com/@procv/post/1'},
        )

        published = provider.publish(
            account_id='me_1', token='t', message='Tuyển gấp', link='https://procv.vn/r/a'
        )

        calls = session.request.call_args_list
        self.assertEqual(calls[0].args[1], 'https://graph.threads.com/v1.0/me_1/threads')
        self.assertEqual(
            calls[0].kwargs['data'],
            {
                'media_type': 'TEXT',
                'text': 'Tuyển gấp\n\nhttps://procv.vn/r/a',
                'link_attachment': 'https://procv.vn/r/a',
            },
        )
        self.assertNotIn('appsecret_proof', calls[0].kwargs['params'])
        self.assertEqual(calls[3].kwargs['data'], {'creation_id': 'container'})
        self.assertEqual(published.permalink, 'https://threads.com/@procv/post/1')

    def test_images_become_an_image_post_or_a_carousel(self):
        image = PostImage('a.jpg', b'1', 'https://cdn/a.jpg')
        single, single_session = self.provider(
            {'id': 'c'}, {'status': 'FINISHED'}, {'id': 't'}, {'permalink': ''}
        )
        carousel, carousel_session = self.provider(
            {'id': 'c1'},
            {'status': 'FINISHED'},
            {'id': 'c2'},
            {'status': 'FINISHED'},
            {'id': 'parent'},
            {'status': 'FINISHED'},
            {'id': 't'},
            {'permalink': ''},
        )

        single.publish(
            account_id='me', token='t', message='m', link='http://localhost/r/a', images=[image]
        )
        carousel.publish(account_id='me', token='t', message='m', link='', images=[image, image])

        sent = single_session.request.call_args_list[0].kwargs['data']
        self.assertEqual(
            sent,
            {
                'media_type': 'IMAGE',
                'image_url': 'https://cdn/a.jpg',
                'text': 'm\n\nhttp://localhost/r/a',
            },
        )
        posts = [
            c.kwargs['data'] for c in carousel_session.request.call_args_list if c.args[0] == 'POST'
        ]
        self.assertEqual(posts[2], {'media_type': 'CAROUSEL', 'children': 'c1,c2', 'text': 'm'})

    def test_refresh_returns_a_new_sixty_day_token(self):
        provider, session = self.provider({'access_token': 'new', 'expires_in': 5184000})

        grant = provider.refresh('old')

        self.assertEqual(
            session.request.call_args_list[0].args[1],
            'https://graph.threads.com/refresh_access_token',
        )
        self.assertEqual(grant.token, 'new')
