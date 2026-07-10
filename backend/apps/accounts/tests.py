import shutil
import tempfile
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from . import oauth
from .models import SocialAccount, User


PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)
TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class AvatarUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def test_authenticated_user_can_upload_avatar_to_media_storage(self):
        user = User.objects.create_user(email='candidate@example.com', password='Password@123')
        self.client.force_authenticate(user=user)

        upload = SimpleUploadedFile('avatar.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(reverse('auth-avatar-upload'), {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('/media/users/avatars/', response.data['avatar_url'])
        user.refresh_from_db()
        self.assertTrue(user.avatar_url.startswith('users/avatars/'))
        self.assertNotIn('://', user.avatar_url)


GOOGLE_PROFILE = {
    'id': 'google-uid-1',
    'email': 'social@example.com',
    'name': 'Nguyễn Social',
    'avatar': 'https://lh3.example.com/a.png',
    'raw': {'sub': 'google-uid-1'},
}


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    OAUTH_GOOGLE_CLIENT_ID='test-client-id',
    OAUTH_GOOGLE_CLIENT_SECRET='test-client-secret',
    ALLOWED_HOSTS=['testserver'],
)
class OAuthFlowTests(APITestCase):
    def setUp(self):
        cache.clear()

    # ---- helpers ----

    def _callback(self, provider='google', portal='main', profile=None, next_path=''):
        """Chạy bước callback với provider đã mock, trả về response redirect."""
        state = oauth.create_state(provider, portal, next_path)
        with (
            patch.object(oauth, 'exchange_code', return_value='provider-token'),
            patch.object(oauth, 'fetch_profile', return_value=profile or dict(GOOGLE_PROFILE)),
        ):
            return self.client.get(
                reverse('auth-oauth-callback', args=[provider]),
                {'code': 'provider-code', 'state': state},
            )

    def _complete(self, redirect_url):
        """Lấy one_time_code từ URL redirect rồi đổi JWT."""
        query = parse_qs(urlparse(redirect_url).query)
        self.assertIn('code', query, f'redirect thiếu code: {redirect_url}')
        return self.client.post(reverse('auth-oauth-complete'), {'code': query['code'][0]})

    # ---- start ----

    def test_start_redirects_to_provider_with_state(self):
        response = self.client.get(
            reverse('auth-oauth-start', args=['google']), {'portal': 'main', 'next': '/viec-lam'}
        )
        self.assertEqual(response.status_code, 302)
        parsed = urlparse(response.url)
        self.assertEqual(parsed.hostname, 'accounts.google.com')
        query = parse_qs(parsed.query)
        self.assertEqual(query['client_id'], ['test-client-id'])
        state_data = cache.get(f'oauth:state:{query["state"][0]}')
        self.assertEqual(state_data, {'provider': 'google', 'portal': 'main', 'next': '/viec-lam'})

    def test_start_unconfigured_provider_redirects_with_error(self):
        response = self.client.get(reverse('auth-oauth-start', args=['facebook']), {'portal': 'main'})
        self.assertEqual(response.status_code, 302)
        self.assertIn('error=provider_not_configured', response.url)

    def test_employer_portal_rejects_facebook_and_linkedin(self):
        for provider in ('facebook', 'linkedin'):
            response = self.client.get(
                reverse('auth-oauth-start', args=[provider]), {'portal': 'employer'}
            )
            self.assertEqual(response.status_code, 302)
            self.assertIn('error=provider_not_allowed', response.url)
            self.assertIn('/tuyendung/app/oauth/callback', response.url)

    def test_admin_portal_has_no_social_login(self):
        response = self.client.get(reverse('auth-oauth-start', args=['google']), {'portal': 'admin'})
        self.assertEqual(response.status_code, 302)
        self.assertIn('error=portal_not_supported', response.url)

    def test_absolute_next_url_is_dropped(self):
        self.assertEqual(oauth.safe_next('https://evil.com/phish'), '')
        self.assertEqual(oauth.safe_next('//evil.com'), '')
        self.assertEqual(oauth.safe_next('/viec-lam?cat=1'), '/viec-lam?cat=1')

    # ---- callback + complete ----

    def test_full_flow_creates_candidate_user(self):
        response = self._callback(next_path='/viec-lam')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/oauth/callback', response.url)
        self.assertIn('next=%2Fviec-lam', response.url)

        complete = self._complete(response.url)
        self.assertEqual(complete.status_code, 200)
        self.assertIn('access', complete.data)
        self.assertEqual(complete.data['user']['role'], 'candidate')
        self.assertTrue(complete.data['user']['email_verified'])

        user = User.objects.get(email='social@example.com')
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.provider, 'google')
        self.assertTrue(
            SocialAccount.objects.filter(
                user=user, provider='google', provider_user_id='google-uid-1'
            ).exists()
        )

    def test_employer_portal_creates_employer_via_google(self):
        response = self._callback(portal='employer')
        self.assertIn('/tuyendung/app/oauth/callback', response.url)
        complete = self._complete(response.url)
        self.assertEqual(complete.data['user']['role'], 'employer')

    def test_same_email_same_role_links_account(self):
        existing = User.objects.create_user(
            email='social@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        response = self._callback()
        complete = self._complete(response.url)
        self.assertEqual(complete.data['user']['id'], existing.pk)
        existing.refresh_from_db()
        self.assertTrue(existing.email_verified)  # social coi như đã xác thực email
        self.assertTrue(existing.has_usable_password())  # vẫn đăng nhập được bằng mật khẩu cũ
        self.assertEqual(existing.social_accounts.count(), 1)

    def test_same_email_different_role_is_blocked(self):
        User.objects.create_user(
            email='social@example.com', password='Password@123', role=User.Role.EMPLOYER
        )
        response = self._callback(portal='main')
        self.assertEqual(response.status_code, 302)
        self.assertIn('error=wrong_portal', response.url)
        self.assertEqual(SocialAccount.objects.count(), 0)

    def test_existing_social_account_logs_in_without_duplicate(self):
        first = self._complete(self._callback().url)
        second = self._complete(self._callback().url)
        self.assertEqual(first.data['user']['id'], second.data['user']['id'])
        self.assertEqual(SocialAccount.objects.count(), 1)
        self.assertEqual(User.objects.filter(email='social@example.com').count(), 1)

    def test_profile_without_email_is_rejected(self):
        profile = dict(GOOGLE_PROFILE, email='')
        response = self._callback(profile=profile)
        self.assertIn('error=no_email', response.url)

    def test_invalid_state_is_rejected(self):
        response = self.client.get(
            reverse('auth-oauth-callback', args=['google']),
            {'code': 'provider-code', 'state': 'forged-or-expired'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn('error=invalid_state', response.url)

    def test_state_cannot_be_reused(self):
        state = oauth.create_state('google', 'main', '')
        with (
            patch.object(oauth, 'exchange_code', return_value='provider-token'),
            patch.object(oauth, 'fetch_profile', return_value=dict(GOOGLE_PROFILE)),
        ):
            first = self.client.get(
                reverse('auth-oauth-callback', args=['google']),
                {'code': 'provider-code', 'state': state},
            )
            second = self.client.get(
                reverse('auth-oauth-callback', args=['google']),
                {'code': 'provider-code', 'state': state},
            )
        self.assertIn('code=', first.url)
        self.assertIn('error=invalid_state', second.url)

    def test_one_time_code_single_use(self):
        redirect_url = self._callback().url
        first = self._complete(redirect_url)
        self.assertEqual(first.status_code, 200)
        query = parse_qs(urlparse(redirect_url).query)
        second = self.client.post(reverse('auth-oauth-complete'), {'code': query['code'][0]})
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_provider_denied_redirects_with_error(self):
        state = oauth.create_state('google', 'main', '')
        response = self.client.get(
            reverse('auth-oauth-callback', args=['google']),
            {'error': 'access_denied', 'state': state},
        )
        self.assertIn('error=access_denied', response.url)
