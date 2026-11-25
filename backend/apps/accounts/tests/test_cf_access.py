"""Cloudflare Access bắt buộc cho đăng nhập / làm mới phiên admin."""

import time
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..services import cf_access
from .factories import make_admin, refresh_session

TEAM = 'procv.cloudflareaccess.com'
AUD = 'procv-admin-aud'
ACCESS_SETTINGS = {'CLOUDFLARE_ACCESS_TEAM_DOMAIN': TEAM, 'CLOUDFLARE_ACCESS_AUD': AUD}
SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def access_token(*, aud=AUD, iss=f'https://{TEAM}', expires_in=300, key=SIGNING_KEY):
    now = int(time.time())
    claims = {'aud': [aud], 'iss': iss, 'iat': now, 'exp': now + expires_in, 'email': 'a@x.vn'}
    return jwt.encode(claims, key, algorithm='RS256')


def trusted_keys():
    return mock.patch.object(cf_access, '_signing_key', return_value=SIGNING_KEY.public_key())


@override_settings(**ACCESS_SETTINGS)
class RequireAccessTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _check(self, **request_kwargs):
        with trusted_keys():
            cf_access.require_access(self.factory.post('/api/auth/login/', **request_kwargs))

    @override_settings(CLOUDFLARE_ACCESS_TEAM_DOMAIN='', CLOUDFLARE_ACCESS_AUD='')
    def test_is_skipped_until_configured(self):
        cf_access.require_access(self.factory.post('/api/auth/login/'))

    def test_rejects_a_request_without_access_token(self):
        with self.assertRaises(cf_access.CloudflareAccessRequired):
            self._check()

    def test_accepts_the_access_header(self):
        self._check(HTTP_CF_ACCESS_JWT_ASSERTION=access_token())

    def test_accepts_the_access_cookie(self):
        self.factory.cookies[cf_access.ACCESS_COOKIE] = access_token()
        self._check()

    def test_rejects_invalid_tokens(self):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cases = {
            'aud khác': access_token(aud='other-app'),
            'issuer khác': access_token(iss='https://evil.cloudflareaccess.com'),
            'hết hạn': access_token(expires_in=-60),
            'ký bằng khóa lạ': access_token(key=other_key),
            'không phải JWT': 'not-a-jwt',
        }
        for label, token in cases.items():
            with self.subTest(label), self.assertRaises(cf_access.CloudflareAccessRequired):
                self._check(HTTP_CF_ACCESS_JWT_ASSERTION=token)

    def test_fails_closed_when_signing_keys_cannot_be_loaded(self):
        failing = mock.patch.object(
            cf_access, '_signing_key', side_effect=jwt.PyJWKClientError('offline')
        )
        request = self.factory.post('/', HTTP_CF_ACCESS_JWT_ASSERTION=access_token())
        with failing, self.assertRaises(cf_access.CloudflareAccessRequired):
            cf_access.require_access(request)


@override_settings(
    **ACCESS_SETTINGS,
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class AdminLoginBehindAccessTests(APITestCase):
    def setUp(self):
        cache.clear()
        make_admin('admin@example.com', password='Password@123')

    def _login(self, **extra):
        payload = {
            'email': 'admin@example.com',
            'password': 'Password@123',
            'captcha_token': 'x',
            'portal': 'admin',
        }
        with trusted_keys():
            return self.client.post(reverse('auth-login'), payload, format='json', **extra)

    def test_admin_login_outside_access_is_forbidden(self):
        response = self._login()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn('access', response.data)

    def test_admin_login_with_access_session_succeeds(self):
        self.client.cookies[cf_access.ACCESS_COOKIE] = access_token()

        response = self._login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_admin_refresh_outside_access_is_forbidden(self):
        self.client.cookies[cf_access.ACCESS_COOKIE] = access_token()
        self.assertEqual(self._login().status_code, status.HTTP_200_OK)
        del self.client.cookies[cf_access.ACCESS_COOKIE]

        with trusted_keys():
            response = refresh_session(self.client, portal='admin')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
