from unittest import mock

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.privacy.domain import CONSENT_SIGNING_SALT, VIEWER_SIGNING_SALT


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
        self.assertEqual(
            response.data,
            {
                'version': settings.CONSENT_POLICY_VERSION,
                'necessary': True,
                'preferences': True,
                'analytics': True,
                'marketing': False,
            },
        )
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

    def test_saved_choice_is_read_back_from_the_cookie(self):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': True},
            format='json',
        )

        response = self.client.get(reverse('privacy-consent'))

        self.assertEqual(
            response.data['consent'],
            {
                'version': settings.CONSENT_POLICY_VERSION,
                'necessary': True,
                'preferences': False,
                'analytics': True,
                'marketing': True,
            },
        )

    def test_omitted_categories_default_to_denied_and_necessary_cannot_be_refused(self):
        response = self.client.post(
            reverse('privacy-consent'), {'necessary': False, 'unknown': True}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                'version': settings.CONSENT_POLICY_VERSION,
                'necessary': True,
                'preferences': False,
                'analytics': False,
                'marketing': False,
            },
        )

    def test_non_boolean_choice_is_rejected_without_setting_a_cookie(self):
        response = self.client.post(
            reverse('privacy-consent'), {'analytics': 'maybe'}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('analytics', response.data)
        self.assertNotIn(settings.CONSENT_COOKIE_NAME, response.cookies)

    def test_cookie_signed_for_another_purpose_or_without_necessary_is_undecided(self):
        payload = {'version': settings.CONSENT_POLICY_VERSION, 'necessary': True}
        self.client.cookies[settings.CONSENT_COOKIE_NAME] = signing.dumps(
            payload, salt=VIEWER_SIGNING_SALT
        )
        self.assertIsNone(self.client.get(reverse('privacy-consent')).data['consent'])

        self.client.cookies[settings.CONSENT_COOKIE_NAME] = signing.dumps(
            {**payload, 'necessary': False}, salt=CONSENT_SIGNING_SALT
        )
        self.assertIsNone(self.client.get(reverse('privacy-consent')).data['consent'])

    def test_granting_analytics_keeps_the_viewer_cookie(self):
        self.client.cookies[settings.JOB_VIEWER_COOKIE_NAME] = 'previous-viewer'

        response = self.client.post(reverse('privacy-consent'), {'analytics': True}, format='json')

        self.assertNotIn(settings.JOB_VIEWER_COOKIE_NAME, response.cookies)

    @override_settings(DEBUG=False)
    def test_consent_writes_are_rate_limited(self):
        cache.clear()
        self.addCleanup(cache.clear)
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'consent': '2/hour'}, clear=False):
            statuses = [
                self.client.post(reverse('privacy-consent'), {}, format='json').status_code
                for _ in range(3)
            ]

        self.assertEqual(statuses, [200, 200, 429])
