from unittest import mock

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.accounts.services.captcha import verify_request_captcha


def _verified_response():
    response = mock.Mock()
    response.json.return_value = {'success': True, 'action': 'login', 'score': 0.9}
    return response


@override_settings(RECAPTCHA_SECRET_KEY='test-secret', RECAPTCHA_SCORE_THRESHOLD=0.5)
class CaptchaRemoteIpTests(SimpleTestCase):
    def _verify(self, **meta):
        request = APIRequestFactory().post('/login/', {'captcha_token': 'token'}, **meta)
        request.data = {'captcha_token': 'token'}
        with mock.patch(
            'apps.accounts.services.captcha.requests.post',
            return_value=_verified_response(),
        ) as post:
            verify_request_captcha(request, 'login')
        return post.call_args.kwargs['data']['remoteip']

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/8'], TRUSTED_PROXY_HOPS=1)
    def test_sends_the_client_address_resolved_through_the_trusted_proxy(self):
        remote_ip = self._verify(
            REMOTE_ADDR='10.0.0.5',
            HTTP_X_FORWARDED_FOR='6.6.6.6, 203.0.113.7',
        )

        self.assertEqual(remote_ip, '203.0.113.7')

    @override_settings(TRUSTED_PROXY_IPS=[], TRUSTED_PROXY_HOPS=1)
    def test_ignores_forwarded_header_from_an_untrusted_peer(self):
        remote_ip = self._verify(
            REMOTE_ADDR='198.51.100.9',
            HTTP_X_FORWARDED_FOR='203.0.113.7',
        )

        self.assertEqual(remote_ip, '198.51.100.9')
