import shutil
import tempfile
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from . import oauth
from .models import AuthEmailJob, SocialAccount, User
from .services import email_verification, password_reset, two_factor
from .tasks import deliver_auth_email_job


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


class ProfileUpdateTests(APITestCase):
    """PATCH /auth/me/: sửa họ tên + SĐT nhiều lần, email không đổi."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='candidate@example.com', password='Password@123', full_name='Tên Cũ',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('auth-me')

    def test_update_name_and_phone(self):
        response = self.client.patch(self.url, {'full_name': 'Lê Văn Hậu', 'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'Lê Văn Hậu')
        self.assertEqual(response.data['phone'], '0912345678')
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'Lê Văn Hậu')
        self.assertEqual(self.user.phone, '0912345678')

    def test_me_response_contains_session_fields_only(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {
            'public_id', 'email', 'role', 'full_name', 'phone', 'avatar_url',
            'email_verified', 'two_factor_enabled', 'job_preferences_configured',
            'has_usable_password',
            'employer_onboarding_required', 'employer_onboarding_step',
            'employer_verification_completed',
        })
        self.assertIs(response.data['job_preferences_configured'], False)
        self.assertIs(response.data['has_usable_password'], True)
        self.assertIs(response.data['employer_verification_completed'], False)
        self.assertTrue({
            'id', 'password', 'token', 'refresh_token', 'permissions',
            'status', 'date_joined', 'last_login',
        }.isdisjoint(response.data))

    def test_can_update_multiple_times(self):
        self.client.patch(self.url, {'full_name': 'Lần 1', 'phone': '0900000001'})
        response = self.client.patch(self.url, {'full_name': 'Lần 2', 'phone': '0900000002'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'Lần 2')
        self.assertEqual(self.user.phone, '0900000002')

    def test_email_is_read_only(self):
        response = self.client.patch(
            self.url, {'full_name': 'Ai Đó', 'email': 'hacker@evil.com'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'candidate@example.com')

    def test_invalid_phone_rejected(self):
        response = self.client.patch(self.url, {'full_name': 'Hợp Lệ', 'phone': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)

    def test_blank_name_rejected(self):
        response = self.client.patch(self.url, {'full_name': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('full_name', response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(self.url, {'full_name': 'X'})
        self.assertIn(response.status_code, (401, 403))


class PasswordChangeTests(APITestCase):
    def test_oauth_user_can_create_first_password_without_current_password(self):
        user = User.objects.create_user(
            email='oauth-employer@example.com',
            password=None,
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(reverse('auth-password-change'), {
            'password': 'NewPassword@123',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPassword@123'))
        self.assertTrue(response.data['user']['has_usable_password'])

    def test_existing_password_requires_correct_current_password(self):
        user = User.objects.create_user(
            email='local-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.client.force_authenticate(user=user)

        missing = self.client.post(reverse('auth-password-change'), {
            'password': 'NewPassword@123',
        }, format='json')
        wrong = self.client.post(reverse('auth-password-change'), {
            'current_password': 'WrongPassword@123',
            'password': 'NewPassword@123',
        }, format='json')

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', missing.data)
        self.assertIn('current_password', wrong.data)

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

    @override_settings(OAUTH_FACEBOOK_CLIENT_ID='', OAUTH_FACEBOOK_CLIENT_SECRET='')
    def test_start_unconfigured_provider_redirects_with_error(self):
        # Override tường minh thay vì dựa vào .env của máy đang chạy test có
        # đang để trống Facebook hay không (từng fail khi dev điền credential thật).
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
        self.assertTrue(user.social_accounts.filter(provider='google').exists())
        self.assertTrue(
            SocialAccount.objects.filter(
                user=user, provider='google', provider_user_id='google-uid-1'
            ).exists()
        )
        self.assertTrue(AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).exists())

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

    def test_same_email_same_role_links_account(self):
        existing = User.objects.create_user(
            email='social@example.com', password='Password@123', role=User.Role.CANDIDATE
        )
        response = self._callback()
        complete = self._complete(response.url)
        self.assertEqual(complete.data['user']['public_id'], str(existing.public_id))
        existing.refresh_from_db()
        self.assertTrue(existing.email_verified)  # social coi như đã xác thực email
        self.assertTrue(existing.has_usable_password())  # vẫn đăng nhập được bằng mật khẩu cũ
        self.assertEqual(existing.social_accounts.count(), 1)

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
            SocialAccount.objects.filter(provider='google', provider_user_id='google-uid-1').count(),
            2,
        )

    def test_existing_social_account_logs_in_without_duplicate(self):
        first = self._complete(self._callback().url)
        second = self._complete(self._callback().url)
        self.assertEqual(first.data['user']['public_id'], second.data['user']['public_id'])
        self.assertEqual(SocialAccount.objects.count(), 1)
        self.assertEqual(User.objects.filter(email='social@example.com').count(), 1)

    def test_social_login_bypasses_email_two_factor(self):
        user = User.objects.create_user(
            email='social@example.com', password='Password@123', role=User.Role.CANDIDATE,
            two_factor_enabled=True,
        )

        complete = self._complete(self._callback().url)

        self.assertEqual(complete.status_code, status.HTTP_200_OK)
        self.assertEqual(complete.data['user']['public_id'], str(user.public_id))
        self.assertIn('access', complete.data)
        self.assertNotIn('two_factor_required', complete.data)
        self.assertFalse(AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.TWO_FACTOR).exists())

    def test_one_user_can_link_multiple_social_providers(self):
        user = oauth.resolve_user('google', dict(GOOGLE_PROFILE), 'main')
        oauth.resolve_user('facebook', {
            'id': 'facebook-uid-1', 'email': user.email, 'name': 'Nguyễn Social', 'avatar': '', 'raw': {},
        }, 'main')
        self.assertEqual(user.social_accounts.count(), 2)

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


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class RegisterEmailAvailabilityTests(APITestCase):
    """Pre-check chỉ phục vụ UX; RegisterSerializer vẫn là điểm chặn cuối."""

    def setUp(self):
        cache.clear()
        self.url = reverse('auth-register-email-availability')

    def test_returns_availability_case_insensitively(self):
        User.objects.create_user(email='existing@example.com', password='Password@123')

        taken = self.client.post(self.url, {'email': 'EXISTING@example.com'})
        available = self.client.post(self.url, {'email': 'new@example.com'})

        self.assertEqual(taken.status_code, status.HTTP_200_OK)
        self.assertEqual(taken.data, {'available': False})
        self.assertEqual(available.status_code, status.HTTP_200_OK)
        self.assertEqual(available.data, {'available': True})

    def test_rejects_invalid_email_before_querying(self):
        response = self.client.post(self.url, {'email': 'not-an-email'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    ALLOWED_HOSTS=['testserver'],
    # ScopedRateThrottle (5/min cho scope 'login') dùng chung cache 'default' —
    # nếu không cô lập, số request cộng dồn qua nhiều lần chạy test trong cùng
    # Redis thật sẽ kích hoạt 429 giả (đã từng gặp phải khi rerun cùng phiên).
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class LastLoginTests(APITestCase):
    """Verify all JWT issuance flows update ``last_login`` consistently."""

    # Django test runner luôn ép DEBUG=False bất kể .env; bypass captcha trong
    # verify_recaptcha() chỉ áp dụng khi DEBUG=True nên phải override tường minh.

    def setUp(self):
        cache.clear()

    def test_password_login_updates_last_login(self):
        user = User.objects.create_user(email='login@example.com', password='Password@123')
        self.assertIsNone(user.last_login)

        response = self.client.post(reverse('auth-login'), {
            'email': 'login@example.com', 'password': 'Password@123', 'captcha_token': 'x',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertIsNotNone(user.last_login)

    def test_wrong_password_does_not_update_last_login(self):
        user = User.objects.create_user(email='login2@example.com', password='Password@123')

        response = self.client.post(reverse('auth-login'), {
            'email': 'login2@example.com', 'password': 'wrong', 'captcha_token': 'x',
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        user.refresh_from_db()
        self.assertIsNone(user.last_login)

    def test_login_is_scoped_per_portal_account(self):
        """Mô hình tách cổng: cùng email có 2 tài khoản (ứng viên/NTD) mật khẩu
        riêng; đăng nhập mỗi cổng chỉ chấp nhận mật khẩu của tài khoản cổng đó."""
        User.objects.create_user(
            email='dual@example.com', password='CandPass@123', role=User.Role.CANDIDATE,
        )
        User.objects.create_user(
            email='dual@example.com', password='EmpPass@123', role=User.Role.EMPLOYER,
        )

        def login(portal, password):
            return self.client.post(reverse('auth-login'), {
                'email': 'dual@example.com', 'password': password,
                'captcha_token': 'x', 'portal': portal,
            })

        # Đúng cổng, đúng mật khẩu -> token đúng role.
        emp_ok = login('employer', 'EmpPass@123')
        self.assertEqual(emp_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(AccessToken(emp_ok.data['access'])['role'], 'employer')

        cand_ok = login('main', 'CandPass@123')
        self.assertEqual(cand_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(AccessToken(cand_ok.data['access'])['role'], 'candidate')

        # Mật khẩu của cổng kia KHÔNG mở được cổng này.
        self.assertEqual(login('employer', 'CandPass@123').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(login('main', 'EmpPass@123').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_wrong_portal_account_absent_is_unauthorized(self):
        """Chỉ có tài khoản ứng viên; đăng nhập cổng NTD -> không có tài khoản NTD
        -> 401 (không lộ việc email tồn tại ở cổng khác)."""
        user = User.objects.create_user(
            email='login3@example.com', password='Password@123', role=User.Role.CANDIDATE,
        )
        response = self.client.post(reverse('auth-login'), {
            'email': 'login3@example.com', 'password': 'Password@123',
            'captcha_token': 'x', 'portal': 'employer',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        user.refresh_from_db()
        self.assertIsNone(user.last_login)

    def test_banned_or_deleted_user_cannot_log_in(self):
        for suffix, fields in (
            ('banned', {'status': User.Status.BANNED}),
            ('deleted', {'is_deleted': True}),
        ):
            user = User.objects.create_user(email=f'{suffix}@example.com', password='Password@123')
            User.objects.filter(pk=user.pk).update(**fields)
            response = self.client.post(reverse('auth-login'), {
                'email': user.email, 'password': 'Password@123', 'captcha_token': 'x',
            })
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_banned_user_cannot_reuse_access_or_refresh_token(self):
        user = User.objects.create_user(email='revoked@example.com', password='Password@123')
        login = self.client.post(reverse('auth-login'), {
            'email': user.email, 'password': 'Password@123', 'captcha_token': 'x',
        })
        User.objects.filter(pk=user.pk).update(status=User.Status.BANNED)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')
        self.assertEqual(self.client.get(reverse('auth-me')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.credentials()
        refresh = self.client.post(reverse('auth-refresh'), {'refresh': login.data['refresh']})
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_auto_login_sets_last_login(self):
        response = self.client.post(reverse('auth-register'), {
            'email': 'newuser@example.com', 'password': 'Password@123456',
            'role': 'candidate', 'captcha_token': 'x',
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='newuser@example.com')
        self.assertIsNotNone(user.last_login)

    def test_register_rejects_password_shorter_than_eight_characters(self):
        response = self.client.post(reverse('auth-register'), {
            'email': 'short-password@example.com', 'password': 'short',
            'role': 'candidate', 'captcha_token': 'x',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_register_rejects_password_without_required_character_types(self):
        response = self.client.post(reverse('auth-register'), {
            'email': 'weak-password@example.com', 'password': 'matkhaudai',
            'role': 'candidate', 'captcha_token': 'x',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
        OAUTH_GOOGLE_CLIENT_ID='test-client-id',
        OAUTH_GOOGLE_CLIENT_SECRET='test-client-secret',
    )
    def test_oauth_login_sets_last_login(self):
        cache.clear()
        state = oauth.create_state('google', 'main', '')
        with (
            patch.object(oauth, 'exchange_code', return_value='provider-token'),
            patch.object(oauth, 'fetch_profile', return_value=dict(GOOGLE_PROFILE)),
        ):
            callback = self.client.get(
                reverse('auth-oauth-callback', args=['google']),
                {'code': 'provider-code', 'state': state},
            )
        query = parse_qs(urlparse(callback.url).query)
        self.client.post(reverse('auth-oauth-complete'), {'code': query['code'][0]})

        user = User.objects.get(email='social@example.com')
        self.assertIsNotNone(user.last_login)


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='https://main.example.test',
    EMPLOYER_FRONTEND_URL='https://employer.example.test',
    EMPLOYER_EMAIL_VERIFICATION_PATH='/app/account/verify',
    EMPLOYER_PASSWORD_RESET_PATH='/app/reset-password',
)
class AuthSecurityAndEmailTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_verification_token_is_consumed_once(self):
        user = User.objects.create_user(email='verify@example.com', password='Password@123')
        token = email_verification.issue_token(user)

        self.assertEqual(email_verification.consume_token(token), user.pk)
        self.assertIsNone(email_verification.consume_token(token))

    def test_password_reset_token_is_consumed_once(self):
        user = User.objects.create_user(email='reset@example.com', password='Password@123')
        token = password_reset.issue_token(user)

        self.assertEqual(password_reset.consume_token(token), user.pk)
        self.assertIsNone(password_reset.consume_token(token))

    def test_employer_verification_email_uses_employer_portal_link(self):
        user = User.objects.create_user(
            email='employer@example.com', password='Password@123', role=User.Role.EMPLOYER,
        )

        email_verification.send_verification_email(user)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('https://employer.example.test/app/account/verify?token=', mail.outbox[0].body)
        self.assertIn('Mã NTD', mail.outbox[0].body)
        self.assertIn('Xác thực tài khoản', mail.outbox[0].alternatives[0][0])

    def test_employer_password_reset_email_uses_employer_portal_link(self):
        user = User.objects.create_user(
            email='employer-reset@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )

        password_reset.send_password_reset_email(user)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('https://employer.example.test/app/reset-password?token=', mail.outbox[0].body)

    def test_email_outbox_job_is_marked_sent_after_delivery(self):
        user = User.objects.create_user(email='queue@example.com', password='Password@123')
        job = AuthEmailJob.objects.create(user=user, kind=AuthEmailJob.Kind.VERIFICATION)

        deliver_auth_email_job.run(job.pk)

        job.refresh_from_db()
        self.assertEqual(job.status, AuthEmailJob.Status.SENT)
        self.assertEqual(job.attempts, 1)
        self.assertIsNotNone(job.sent_at)

    def test_verification_confirmation_queues_one_welcome_email(self):
        user = User.objects.create_user(email='new@example.com', password='Password@123')
        token = email_verification.issue_token(user)

        response = self.client.post(reverse('auth-verify-confirm'), {'token': token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).exists())

    def test_employer_verification_queues_one_employer_welcome_email(self):
        user = User.objects.create_user(
            email='employer-welcome@example.com', password='Password@123', role=User.Role.EMPLOYER,
        )
        token = email_verification.issue_token(user)

        response = self.client.post(reverse('auth-verify-confirm'), {'token': token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        job = AuthEmailJob.objects.get(user=user, kind=AuthEmailJob.Kind.WELCOME)
        self.assertEqual(job.context, {'registration_method': 'email'})

        reused = self.client.post(reverse('auth-verify-confirm'), {'token': token})
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.WELCOME).count(),
            1,
        )

    def test_welcome_email_is_delivered_from_the_outbox(self):
        user = User.objects.create_user(email='welcome@example.com', password='Password@123', email_verified=True)
        job = AuthEmailJob.objects.create(user=user, kind=AuthEmailJob.Kind.WELCOME)

        deliver_auth_email_job.run(job.pk)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Chào mừng', mail.outbox[0].subject)

    def test_employer_welcome_email_uses_employer_content_and_portal_link(self):
        user = User.objects.create_user(
            email='hr-welcome@example.com',
            password=None,
            role=User.Role.EMPLOYER,
            full_name='Nguyễn Minh Anh',
            email_verified=True,
        )
        job = AuthEmailJob.objects.create(
            user=user,
            kind=AuthEmailJob.Kind.WELCOME,
            context={'registration_method': 'google'},
        )

        deliver_auth_email_job.run(job.pk)

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(
            message.subject,
            'Chúc mừng Nguyễn Minh Anh đã có tài khoản dành cho nhà tuyển dụng',
        )
        self.assertIn(f'Mã NTD {user.public_id}', message.body)
        self.assertIn('Google đã xác thực địa chỉ email', message.body)
        self.assertIn('https://employer.example.test/tuyendung/app/employer-verify', message.body)
        self.assertIn('Tiếp tục thiết lập tài khoản', message.alternatives[0][0])


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    ALLOWED_HOSTS=['testserver'],
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    TWO_FACTOR_CODE_TTL=180,
)
class TwoFactorAuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='twofactor@example.com', password='Password@123')

    def test_user_can_enable_two_factor_with_email_code(self):
        self.client.force_authenticate(user=self.user)
        sent = self.client.post(reverse('auth-two-factor-setup-send'))

        self.assertEqual(sent.status_code, status.HTTP_200_OK)
        self.assertEqual(sent.data['expires_in'], 180)
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_SETUP))
        self.assertRegex(code, r'^\d{6}$')

        confirmed = self.client.post(reverse('auth-two-factor-setup-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertTrue(confirmed.data['two_factor_enabled'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.two_factor_enabled)
        self.assertIsNone(cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_SETUP)))

    def test_two_factor_login_only_issues_tokens_after_correct_code(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=['two_factor_enabled'])

        login = self.client.post(reverse('auth-login'), {
            'email': self.user.email, 'password': 'Password@123', 'captcha_token': 'x', 'portal': 'main',
        })
        self.assertEqual(login.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(login.data['two_factor_required'])
        self.assertNotIn('access', login.data)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.last_login)

        challenge = login.data['challenge']
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_LOGIN))
        wrong_code = '000001' if code == '000000' else '000000'
        wrong = self.client.post(reverse('auth-two-factor-login-verify'), {'challenge': challenge, 'code': wrong_code})
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)

        verified = self.client.post(reverse('auth-two-factor-login-verify'), {'challenge': challenge, 'code': code})
        self.assertEqual(verified.status_code, status.HTTP_200_OK)
        self.assertIn('access', verified.data)
        self.assertIn('refresh', verified.data)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_user_can_disable_two_factor_with_email_code(self):
        self.user.two_factor_enabled = True
        self.user.save(update_fields=['two_factor_enabled'])
        self.client.force_authenticate(user=self.user)

        sent = self.client.post(reverse('auth-two-factor-disable-send'))
        self.assertEqual(sent.status_code, status.HTTP_200_OK)
        code = cache.get(two_factor._code_key(self.user.pk, two_factor.PURPOSE_DISABLE))

        confirmed = self.client.post(reverse('auth-two-factor-disable-confirm'), {'code': code})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertFalse(confirmed.data['two_factor_enabled'])
        self.user.refresh_from_db()
        self.assertFalse(self.user.two_factor_enabled)
