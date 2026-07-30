"""Kiểm toán bảo mật luồng xác thực nhà tuyển dụng.

Mỗi test ở đây tương ứng một finding của lượt rà soát luồng NTD: nó mô tả hành
vi ĐÚNG phải có, nên chạy trên code chưa vá thì đỏ. Xem kế hoạch kiểm toán để
biết bối cảnh từng mục (A1, A2, ...).
"""

import inspect
from time import time
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import get_resolver, reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from common.security import AuthCookieOriginMiddleware

from ..models import AuthSession, User
from ..services import two_factor
from ..services.refresh_cookies import cookie_name
from ..services.tokens import issue_tokens

LOCMEM_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
PASSWORD = 'Password@123'


def rest_framework_with_rates(**rates):
    """Nới một vài scope throttle mà GIỮ NGUYÊN phần còn lại của REST_FRAMEWORK.

    ``override_settings(REST_FRAMEWORK={...})`` thay cả dict, làm DRF rơi về
    authentication/permission mặc định và test mất đúng thứ đang muốn đo.
    """
    from django.conf import settings

    base = settings.REST_FRAMEWORK
    return {**base, 'DEFAULT_THROTTLE_RATES': {**base['DEFAULT_THROTTLE_RATES'], **rates}}


def employer_login_payload(email, password=PASSWORD):
    return {'email': email, 'password': password, 'captcha_token': 'x', 'portal': 'employer'}


@override_settings(RECAPTCHA_SECRET_KEY='', DEBUG=True, CACHES=LOCMEM_CACHE)
class LoginThrottleIdentityTests(APITestCase):
    """A1 — throttle đăng nhập phải bám IP thật, không bám header client tự khai.

    DRF mặc định (``NUM_PROXIES = None``) lấy nguyên chuỗi ``X-Forwarded-For``
    làm khoá throttle, còn nginx thì NỐI giá trị client gửi vào header đó. Kẻ
    tấn công chỉ cần đổi header mỗi request là có bucket mới, vô hiệu hoá toàn
    bộ giới hạn của các endpoint auth.
    """

    def setUp(self):
        cache.clear()

    def test_spoofed_forwarded_for_cannot_reset_the_login_rate_limit(self):
        # Mỗi request một email khác nhau để chỉ còn giới hạn theo IP tham gia,
        # không lẫn với bộ đếm thất bại theo tài khoản.
        statuses = [
            self.client.post(
                reverse('auth-login'),
                employer_login_payload(f'nobody{index}@example.com'),
                HTTP_X_FORWARDED_FOR=f'203.0.113.{index}',
            ).status_code
            for index in range(7)
        ]

        self.assertIn(
            status.HTTP_429_TOO_MANY_REQUESTS,
            statuses,
            'Đổi X-Forwarded-For mỗi request vẫn không được cấp bucket throttle mới.',
        )

    def test_untrusted_forwarded_for_does_not_split_the_bucket_from_a_single_ip(self):
        """Hai request cùng REMOTE_ADDR phải dùng chung quota dù khai XFF khác nhau."""
        first = self.client.post(
            reverse('auth-login'),
            employer_login_payload('nobody-a@example.com'),
            REMOTE_ADDR='198.51.100.7',
            HTTP_X_FORWARDED_FOR='10.0.0.1',
        )
        self.assertEqual(first.status_code, status.HTTP_401_UNAUTHORIZED)

        for index in range(6):
            last = self.client.post(
                reverse('auth-login'),
                employer_login_payload(f'nobody-b{index}@example.com'),
                REMOTE_ADDR='198.51.100.7',
                HTTP_X_FORWARDED_FOR=f'10.0.0.{index + 2}',
            )

        self.assertEqual(last.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    CACHES=LOCMEM_CACHE,
    # Tách bạch: nới throttle theo IP để chỉ còn bộ đếm theo tài khoản chịu trách
    # nhiệm chặn, nếu không request thứ 6 sẽ dính 429 vì lý do khác.
    REST_FRAMEWORK=rest_framework_with_rates(login='1000/min'),
)
class PerAccountLoginBackoffTests(APITestCase):
    """A3 — dò mật khẩu phân tán nhiều IP phải bị làm chậm theo từng tài khoản."""

    def setUp(self):
        cache.clear()
        self.employer = User.objects.create_user(
            email='recruiter@example.com',
            password=PASSWORD,
            role=User.Role.EMPLOYER,
        )

    def _fail_login(self, index):
        return self.client.post(
            reverse('auth-login'),
            employer_login_payload(self.employer.email, password=f'Wrong@{index}'),
            REMOTE_ADDR=f'203.0.113.{index % 250}',
        )

    def test_repeated_failures_on_one_account_are_slowed_down_across_ips(self):
        statuses = [self._fail_login(index).status_code for index in range(12)]

        self.assertIn(
            status.HTTP_429_TOO_MANY_REQUESTS,
            statuses,
            'Dò mật khẩu một tài khoản NTD từ nhiều IP không bị làm chậm.',
        )

    def test_the_candidate_account_on_the_same_email_is_not_slowed_down(self):
        """Mô hình tách cổng: khoá nhịp của cổng NTD không được đụng cổng ứng viên."""
        User.objects.create_user(
            email=self.employer.email,
            password=PASSWORD,
            role=User.Role.CANDIDATE,
        )
        for index in range(12):
            self._fail_login(index)

        candidate_login = self.client.post(
            reverse('auth-login'),
            {
                'email': self.employer.email,
                'password': PASSWORD,
                'captcha_token': 'x',
                'portal': 'main',
            },
        )

        self.assertEqual(candidate_login.status_code, status.HTTP_200_OK)

    def test_a_successful_login_clears_the_backoff(self):
        for index in range(4):
            self._fail_login(index)

        success = self.client.post(
            reverse('auth-login'), employer_login_payload(self.employer.email)
        )
        self.assertEqual(success.status_code, status.HTTP_200_OK)

        retry = self.client.post(reverse('auth-login'), employer_login_payload(self.employer.email))
        self.assertEqual(retry.status_code, status.HTTP_200_OK)


@override_settings(RECAPTCHA_SECRET_KEY='', DEBUG=True, CACHES=LOCMEM_CACHE)
class LoginUserEnumerationTests(APITestCase):
    """B2 — thời gian phản hồi không được tiết lộ email NTD nào đã tồn tại."""

    def setUp(self):
        cache.clear()
        User.objects.create_user(
            email='known@example.com', password=PASSWORD, role=User.Role.EMPLOYER
        )

    def _password_hash_calls(self, email):
        with (
            patch('django.contrib.auth.base_user.check_password', return_value=False) as verify,
            patch('django.contrib.auth.base_user.make_password', return_value='!') as encode,
        ):
            self.client.post(reverse('auth-login'), employer_login_payload(email, 'Wrong@123'))
        return verify.call_count + encode.call_count

    def test_login_hashes_a_password_even_when_the_account_does_not_exist(self):
        known = self._password_hash_calls('known@example.com')
        unknown = self._password_hash_calls('unknown@example.com')

        self.assertEqual(known, 1)
        self.assertEqual(
            unknown,
            known,
            'Email không tồn tại bỏ qua bước băm mật khẩu nên trả lời nhanh hơn hẳn.',
        )


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    CACHES=LOCMEM_CACHE,
    TWO_FACTOR_CODE_TTL=180,
    REST_FRAMEWORK=rest_framework_with_rates(login='1000/min', two_factor_verify='1000/min'),
)
class TwoFactorLoginBruteForceTests(APITestCase):
    """A2 — mọi phương thức MFA phải bị giới hạn số lần nhập sai, không riêng email."""

    def setUp(self):
        cache.clear()
        self.employer = User.objects.create_user(
            email='mfa-recruiter@example.com',
            password=PASSWORD,
            role=User.Role.EMPLOYER,
        )
        self.secret = two_factor.generate_totp_secret()
        self.employer.two_factor_totp_secret = two_factor.encrypt_totp_secret(self.secret)
        self.employer.two_factor_enabled = True
        self.employer.save(
            update_fields=['two_factor_totp_secret', 'two_factor_enabled', 'updated_at']
        )

    def _start_challenge(self):
        login = self.client.post(reverse('auth-login'), employer_login_payload(self.employer.email))
        self.assertEqual(login.status_code, status.HTTP_202_ACCEPTED)
        return login.data['challenge']

    def _verify(self, challenge, code, method='totp'):
        return self.client.post(
            reverse('auth-two-factor-login-verify'),
            {'challenge': challenge, 'code': code, 'method': method},
        )

    def _current_totp(self):
        counter = int(time()) // two_factor.TOTP_PERIOD_SECONDS
        return two_factor._totp_code(self.secret, counter)

    def test_a_challenge_dies_after_too_many_wrong_totp_codes(self):
        challenge = self._start_challenge()
        for index in range(two_factor.MAX_VERIFY_ATTEMPTS):
            wrong = self._verify(challenge, f'{index:06d}')
            self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)

        replayed = self._verify(challenge, self._current_totp())

        self.assertEqual(
            replayed.status_code,
            status.HTTP_400_BAD_REQUEST,
            'Challenge vẫn sống sau nhiều lần nhập sai TOTP nên có thể dò 6 chữ số.',
        )
        self.assertNotIn('access', replayed.data)

    def test_a_challenge_dies_after_too_many_wrong_backup_codes(self):
        codes = two_factor.replace_backup_codes(self.employer)
        challenge = self._start_challenge()
        for index in range(two_factor.MAX_VERIFY_ATTEMPTS):
            self._verify(challenge, f'{index:08d}', method='backup')

        replayed = self._verify(challenge, codes[0], method='backup')

        self.assertEqual(replayed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('access', replayed.data)

    def test_a_fresh_challenge_still_accepts_a_correct_code(self):
        """Bộ đếm phải bám challenge, không được khoá vĩnh viễn tài khoản."""
        first = self._start_challenge()
        for index in range(two_factor.MAX_VERIFY_ATTEMPTS):
            self._verify(first, f'{index:06d}')

        second = self._start_challenge()
        accepted = self._verify(second, self._current_totp())

        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertIn('access', accepted.data)


@override_settings(RECAPTCHA_SECRET_KEY='', DEBUG=True, CACHES=LOCMEM_CACHE)
class RefreshTokenReuseTests(APITestCase):
    """C1 — dùng lại refresh token đã xoay vòng là dấu hiệu bị trộm ⇒ giết phiên."""

    def setUp(self):
        cache.clear()
        self.employer = User.objects.create_user(
            email='rotate@example.com', password=PASSWORD, role=User.Role.EMPLOYER
        )
        self.tokens = issue_tokens(self.employer, None, auth_method='password')

    def _refresh_with(self, refresh):
        self.client.cookies[cookie_name('employer')] = str(refresh)
        return self.client.post(reverse('auth-refresh'), {'portal': 'employer'}, format='json')

    @override_settings(AUTH_REFRESH_REUSE_GRACE_SECONDS=0)
    def test_replaying_a_rotated_refresh_token_revokes_the_whole_session(self):
        """Ân hạn 0 giây mô phỏng bản sao bị trộm được dùng lâu sau lần xoay vòng."""
        stolen = self.tokens['refresh']
        rotated = self._refresh_with(stolen)
        self.assertEqual(rotated.status_code, status.HTTP_200_OK)
        fresh = self.client.cookies[cookie_name('employer')].value

        replayed = self._refresh_with(stolen)
        self.assertEqual(replayed.status_code, status.HTTP_401_UNAUTHORIZED)

        session = AuthSession.objects.get(user=self.employer)
        self.assertIsNotNone(
            session.revoked_at,
            'Refresh token cũ bị phát lại mà phiên vẫn sống: kẻ trộm cookie tiếp tục xoay vòng.',
        )

        after_reuse = self._refresh_with(fresh)
        self.assertEqual(after_reuse.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_losing_a_refresh_race_inside_the_grace_window_keeps_the_session(self):
        """Hai tab cùng refresh là chuyện thường ngày, không được coi là bị trộm."""
        raced = self.tokens['refresh']
        self.assertEqual(self._refresh_with(raced).status_code, status.HTTP_200_OK)
        fresh = self.client.cookies[cookie_name('employer')].value

        loser = self._refresh_with(raced)
        self.assertEqual(loser.status_code, status.HTTP_401_UNAUTHORIZED)

        session = AuthSession.objects.get(user=self.employer)
        self.assertIsNone(session.revoked_at)
        self.assertEqual(self._refresh_with(fresh).status_code, status.HTTP_200_OK)

    @override_settings(AUTH_REFRESH_REUSE_GRACE_SECONDS=0)
    def test_a_forged_refresh_token_cannot_revoke_someone_elses_session(self):
        """Chỉ chữ ký hợp lệ mới được kích hoạt thu hồi, nếu không đây là DoS."""
        forged = self.tokens['refresh'][:-4] + 'AAAA'

        self.assertEqual(self._refresh_with(forged).status_code, status.HTTP_401_UNAUTHORIZED)

        session = AuthSession.objects.get(user=self.employer)
        self.assertIsNone(session.revoked_at)


class AuthCookieOriginCoverageTests(APITestCase):
    """E2 — mọi view phát cookie refresh phải nằm trong danh sách chặn CSRF."""

    def _cookie_minting_routes(self):
        for pattern in get_resolver().url_patterns:
            for route in getattr(pattern, 'url_patterns', []):
                view_class = getattr(route.callback, 'cls', None) or getattr(
                    route.callback, 'view_class', None
                )
                if view_class is None:
                    continue
                try:
                    source = inspect.getsource(view_class)
                except (OSError, TypeError):
                    continue
                if 'set_refresh_cookie' in source:
                    yield view_class.__name__, f'/{pattern.pattern}{route.pattern}'

    def test_the_canary_actually_discovers_the_cookie_minting_views(self):
        """Nếu cách dò hỏng, test dưới sẽ xanh giả. Neo lại bằng các view đã biết."""
        discovered = {name for name, _ in self._cookie_minting_routes()}

        self.assertLessEqual(
            {'LoginView', 'RegisterView', 'TwoFactorLoginVerifyView', 'EmployerRegisterView'},
            discovered,
        )

    def test_every_cookie_minting_endpoint_is_origin_protected(self):
        unprotected = [
            f'{name} -> {path}'
            for name, path in self._cookie_minting_routes()
            if path not in AuthCookieOriginMiddleware._PATHS
        ]

        self.assertEqual(
            unprotected,
            [],
            'View phát cookie refresh nhưng thiếu trong AuthCookieOriginMiddleware._PATHS.',
        )


@override_settings(RECAPTCHA_SECRET_KEY='', DEBUG=True, CACHES=LOCMEM_CACHE)
class SessionRevocationOnRefreshTests(APITestCase):
    """Khẳng định hành vi ĐANG ĐÚNG, để lần vá C1 không phá vỡ nó."""

    def setUp(self):
        cache.clear()
        self.employer = User.objects.create_user(
            email='revoke@example.com', password=PASSWORD, role=User.Role.EMPLOYER
        )

    def test_a_normal_rotation_keeps_the_session_alive(self):
        tokens = issue_tokens(self.employer, None, auth_method='password')
        self.client.cookies[cookie_name('employer')] = tokens['refresh']

        for _ in range(3):
            response = self.client.post(
                reverse('auth-refresh'), {'portal': 'employer'}, format='json'
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        session = AuthSession.objects.get(user=self.employer)
        self.assertIsNone(session.revoked_at)
        current = RefreshToken(self.client.cookies[cookie_name('employer')].value)
        self.assertEqual(session.refresh_jti, current[api_settings.JTI_CLAIM])
