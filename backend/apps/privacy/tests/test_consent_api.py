from django.conf import settings
from django.core import signing
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.privacy.constants import CONSENT_SIGNING_SALT


class ConsentApiTests(APITestCase):
    def test_new_visitor_is_undecided(self):
        response = self.client.get(reverse('privacy-consent'))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['consent'])

    def test_post_sets_signed_http_only_cookie_and_normalizes_necessary(self):
        response = self.client.post(
            reverse('privacy-consent'),
            {'preferences': True, 'analytics': True, 'marketing': False},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            'version': settings.CONSENT_POLICY_VERSION,
            'necessary': True,
            'preferences': True,
            'analytics': True,
            'marketing': False,
        })
        cookie = response.cookies[settings.CONSENT_COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], settings.CONSENT_COOKIE_SAMESITE)
        self.assertEqual(int(cookie['max-age']), settings.CONSENT_COOKIE_MAX_AGE)

    def test_tampered_or_old_policy_cookie_is_undecided(self):
        self.client.cookies[settings.CONSENT_COOKIE_NAME] = 'not-a-signed-cookie'
        self.assertIsNone(self.client.get(reverse('privacy-consent')).data['consent'])

        stale = signing.dumps(
            {'version': settings.CONSENT_POLICY_VERSION - 1, 'necessary': True, 'analytics': True},
            salt=CONSENT_SIGNING_SALT,
        )
        self.client.cookies[settings.CONSENT_COOKIE_NAME] = stale
        self.assertIsNone(self.client.get(reverse('privacy-consent')).data['consent'])

    def test_revoking_analytics_deletes_viewer_cookie(self):
        self.client.cookies['procv_viewer_id'] = 'previous-viewer'
        response = self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': False, 'marketing': False},
            format='json',
        )

        self.assertEqual(response.cookies['procv_viewer_id']['max-age'], 0)
