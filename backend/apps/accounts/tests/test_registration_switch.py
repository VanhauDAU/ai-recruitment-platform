"""Công tắc admin tạm dừng đăng ký (SiteSetting *_allow_registration, ADR-0026)."""

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.services import oauth
from apps.sitecontent.models import SiteSetting

from ..models import User
from .factories import GOOGLE_PROFILE


def _close(key):
    SiteSetting.objects.update_or_create(
        key=key, defaults={'value': False, 'value_type': SiteSetting.ValueType.BOOLEAN}
    )


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    ALLOWED_HOSTS=['testserver'],
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class RegistrationSwitchTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _register(self, email='new@example.com'):
        return self.client.post(
            reverse('auth-register'),
            {
                'email': email,
                'password': 'Password@123456',
                'role': 'candidate',
                'captcha_token': 'x',
            },
        )

    def test_closed_candidate_registration_rejects_the_form_with_a_code(self):
        _close('candidate_allow_registration')

        response = self._register()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'registration_closed')
        self.assertFalse(User.objects.filter(email='new@example.com').exists())

    def test_closing_the_employer_portal_does_not_close_candidates(self):
        _close('employer_allow_registration')

        self.assertEqual(self._register().status_code, status.HTTP_201_CREATED)

    def test_closed_registration_blocks_new_oauth_accounts_but_not_existing_ones(self):
        existing = User.objects.create_user(
            email=GOOGLE_PROFILE['email'], password=None, role=User.Role.CANDIDATE
        )
        _close('candidate_allow_registration')

        self.assertEqual(oauth.resolve_user('google', dict(GOOGLE_PROFILE), 'main'), existing)
        with self.assertRaisesRegex(oauth.OAuthError, 'registration_closed'):
            oauth.resolve_user(
                'google',
                {**GOOGLE_PROFILE, 'id': 'google-new', 'email': 'other@example.com'},
                'main',
            )
