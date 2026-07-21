"""Luồng đăng nhập social (Google/Facebook/LinkedIn) và liên kết tài khoản."""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .. import oauth
from ..models import AuthEmailJob, SocialAccount, User
from .helpers import GOOGLE_PROFILE


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

    @override_settings(OAUTH_FACEBOOK_CLIENT_ID='', OAUTH_FACEBOOK_CLIENT_SECRET='')
    def test_start_unconfigured_provider_redirects_with_error(self):
        # Override tường minh thay vì dựa vào .env của máy đang chạy test có
        # đang để trống Facebook hay không (từng fail khi dev điền credential thật).
        response = self.client.get(
            reverse('auth-oauth-start', args=['facebook']), {'portal': 'main'}
        )
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
        response = self.client.get(
            reverse('auth-oauth-start', args=['google']), {'portal': 'admin'}
        )
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
        self.assertTrue(user.social_accounts.filter(provider='google').exists())
        self.assertTrue(
            SocialAccount.objects.filter(
                user=user, provider='google', provider_user_id='google-uid-1'
            ).exists()
        )
        self.assertTrue(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).exists()
        )

    def test_employer_portal_creates_employer_via_google(self):
        response = self._callback(portal='employer')
        self.assertIn('/tuyendung/app/oauth/callback', response.url)
        complete = self._complete(response.url)
        self.assertEqual(complete.data['user']['role'], 'employer')

        user = User.objects.get(email='social@example.com')
        job = AuthEmailJob.objects.get(user=user, kind=AuthEmailJob.Kind.WELCOME)
        self.assertEqual(job.context, {'registration_method': 'google'})

        self._complete(self._callback(portal='employer').url)
        self.assertEqual(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).count(),
            1,
        )

    def test_same_email_same_role_requires_confirmed_linking(self):
        existing = User.objects.create_user(
            email='social@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        response = self._callback()
        self.assertIn('error=link_confirmation_required', response.url)
        existing.refresh_from_db()
        self.assertFalse(existing.email_verified)
        self.assertTrue(existing.has_usable_password())
        self.assertEqual(existing.social_accounts.count(), 0)

    def test_google_employer_portal_creates_separate_account_from_candidate(self):
        """Mô hình tách cổng: đã có tài khoản ỨNG VIÊN cùng email; Google cổng NTD
        tạo tài khoản NTD RIÊNG (không đụng tài khoản ứng viên)."""
        candidate = User.objects.create_user(
            email='social@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        complete = self._complete(self._callback(portal='employer').url)

        self.assertEqual(complete.status_code, 200)
        self.assertEqual(complete.data['user']['role'], 'employer')
        self.assertNotEqual(complete.data['user']['public_id'], str(candidate.public_id))
        # Hai tài khoản độc lập cùng email, khác role.
        self.assertEqual(User.objects.filter(email__iexact='social@example.com').count(), 2)
        employer = User.objects.get(email__iexact='social@example.com', role=User.Role.EMPLOYER)
        self.assertTrue(employer.social_accounts.filter(provider='google').exists())
        # Tài khoản ứng viên giữ nguyên mật khẩu riêng.
        candidate.refresh_from_db()
        self.assertTrue(candidate.check_password('Password@123'))

    def test_same_google_id_links_both_portal_accounts(self):
        """Cùng một google-id gắn được vào cả tài khoản ứng viên lẫn NTD (2 row)."""
        cand = self._complete(self._callback(portal='main').url)
        emp = self._complete(self._callback(portal='employer').url)
        self.assertEqual(cand.data['user']['role'], 'candidate')
        self.assertEqual(emp.data['user']['role'], 'employer')
        self.assertNotEqual(cand.data['user']['public_id'], emp.data['user']['public_id'])
        self.assertEqual(
            SocialAccount.objects.filter(
                provider='google', provider_user_id='google-uid-1'
            ).count(),
            2,
        )

    def test_existing_social_account_logs_in_without_duplicate(self):
        first = self._complete(self._callback().url)
        second = self._complete(self._callback().url)
        self.assertEqual(first.data['user']['public_id'], second.data['user']['public_id'])
        self.assertEqual(SocialAccount.objects.count(), 1)
        self.assertEqual(User.objects.filter(email='social@example.com').count(), 1)

    def test_social_login_bypasses_email_two_factor(self):
        self._complete(self._callback().url)
        user = User.objects.get(email='social@example.com', role=User.Role.CANDIDATE)
        user.two_factor_enabled = True
        user.save(update_fields=['two_factor_enabled'])

        complete = self._complete(self._callback().url)

        self.assertEqual(complete.status_code, status.HTTP_200_OK)
        self.assertEqual(complete.data['user']['public_id'], str(user.public_id))
        self.assertIn('access', complete.data)
        self.assertNotIn('two_factor_required', complete.data)
        self.assertFalse(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.TWO_FACTOR).exists()
        )

    def test_second_provider_requires_confirmed_linking(self):
        user = oauth.resolve_user('google', dict(GOOGLE_PROFILE), 'main')
        with self.assertRaisesRegex(oauth.OAuthError, 'link_confirmation_required'):
            oauth.resolve_user(
                'facebook',
                {
                    'id': 'facebook-uid-1',
                    'email': user.email,
                    'email_verified': True,
                    'name': 'Nguyễn Social',
                    'avatar': '',
                    'raw': {'verified': True},
                },
                'main',
            )
        self.assertEqual(user.social_accounts.count(), 1)

    def test_unverified_provider_email_is_rejected(self):
        response = self._callback(profile={**GOOGLE_PROFILE, 'email_verified': False})
        self.assertIn('error=email_not_verified', response.url)

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
