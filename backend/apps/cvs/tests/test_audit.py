"""The CV access audit keys the client IP on what the trusted proxy saw, not on the client."""

from django.test import RequestFactory, SimpleTestCase, override_settings

from apps.cvs.services.audit import request_access_metadata


class RequestAccessMetadataTests(SimpleTestCase):
    def ip_hash(self, **meta):
        return request_access_metadata(RequestFactory().get('/', **meta))[0]

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_forwarded_for_from_an_untrusted_peer_is_ignored(self):
        spoofed = self.ip_hash(REMOTE_ADDR='198.51.100.4', HTTP_X_FORWARDED_FOR='203.0.113.99')

        self.assertEqual(spoofed, self.ip_hash(REMOTE_ADDR='198.51.100.4'))
        self.assertNotEqual(spoofed, self.ip_hash(REMOTE_ADDR='203.0.113.99'))

    @override_settings(TRUSTED_PROXY_IPS=['10.0.0.0/8'], TRUSTED_PROXY_HOPS=1)
    def test_behind_the_proxy_the_client_cannot_choose_the_leftmost_value(self):
        # nginx appends the address it observed; everything left of it is client-supplied.
        forwarded = self.ip_hash(
            REMOTE_ADDR='10.0.0.2', HTTP_X_FORWARDED_FOR='203.0.113.99, 198.51.100.4'
        )

        self.assertEqual(forwarded, self.ip_hash(REMOTE_ADDR='198.51.100.4'))
        self.assertNotEqual(forwarded, self.ip_hash(REMOTE_ADDR='203.0.113.99'))
