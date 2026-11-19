"""Tầng HTTP: kiểm tra email còn trống khi đăng ký."""

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import SocialAccount, User


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

    def test_oauth_identity_email_is_unavailable_in_the_same_portal(self):
        oauth_user = User.objects.create_user(
            email='oauth-current@example.com',
            password=None,
            role=User.Role.EMPLOYER,
        )
        SocialAccount.objects.create(
            user=oauth_user,
            provider=User.Provider.GOOGLE,
            provider_user_id='google-employer-reserved-email',
            email='oauth-original@example.com',
        )

        employer = self.client.post(
            self.url,
            {'email': 'OAUTH-ORIGINAL@example.com', 'role': User.Role.EMPLOYER},
        )
        candidate = self.client.post(
            self.url,
            {'email': 'oauth-original@example.com', 'role': User.Role.CANDIDATE},
        )

        self.assertEqual(employer.data, {'available': False})
        self.assertEqual(candidate.data, {'available': True})

    def test_rejects_invalid_email_before_querying(self):
        response = self.client.post(self.url, {'email': 'not-an-email'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
