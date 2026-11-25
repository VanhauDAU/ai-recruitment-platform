from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from common.http.safe_fetch import RemoteFetchError, RemoteFileTooLarge, fetch_public_file


def _resolves_to(address):
    return patch(
        'common.http.safe_fetch.socket.getaddrinfo',
        return_value=[(2, 1, 6, '', (address, 443))],
    )


def _pool(status=200, chunks=(b'data',), location=None):
    response = MagicMock(status=status, headers={'Location': location} if location else {})
    response.stream.return_value = iter(chunks)
    pool = MagicMock()
    pool.urlopen.return_value = response
    return pool


class SafeFetchTests(SimpleTestCase):
    def test_rejects_non_http_and_private_targets(self):
        for url in ('file:///etc/passwd', 'ftp://example.com/a', 'https://u@example.com/a'):
            with self.subTest(url=url), self.assertRaises(RemoteFetchError):
                fetch_public_file(url, max_size=10)
        for address in ('127.0.0.1', '10.0.0.5', '169.254.169.254', '::1'):
            with self.subTest(address=address), _resolves_to(address):
                with self.assertRaises(RemoteFetchError):
                    fetch_public_file('https://example.com/a.png', max_size=10)

    def test_connects_to_the_checked_address(self):
        with _resolves_to('93.184.216.34'):
            with patch('common.http.safe_fetch.urllib3.HTTPSConnectionPool') as pool_class:
                pool_class.return_value = _pool()
                data = fetch_public_file('https://example.com/a.png?w=1', max_size=10)
        self.assertEqual(data, b'data')
        self.assertEqual(pool_class.call_args.args, ('93.184.216.34', 443))
        self.assertEqual(pool_class.call_args.kwargs['server_hostname'], 'example.com')
        self.assertEqual(pool_class.return_value.urlopen.call_args.args[1], '/a.png?w=1')

    def test_redirect_to_private_host_is_rejected(self):
        resolved = [[(2, 1, 6, '', (ip, 443))] for ip in ('93.184.216.34', '127.0.0.1')]
        with patch('common.http.safe_fetch.socket.getaddrinfo', side_effect=resolved):
            with patch('common.http.safe_fetch.urllib3.HTTPSConnectionPool') as pool_class:
                pool_class.return_value = _pool(status=302, location='https://internal.test/x')
                with self.assertRaises(RemoteFetchError):
                    fetch_public_file('https://example.com/a.png', max_size=10)
        self.assertEqual(pool_class.call_count, 1)

    def test_stops_at_the_size_limit(self):
        with _resolves_to('93.184.216.34'):
            with patch('common.http.safe_fetch.urllib3.HTTPSConnectionPool') as pool_class:
                pool_class.return_value = _pool(chunks=(b'123456', b'789012'))
                with self.assertRaises(RemoteFileTooLarge):
                    fetch_public_file('https://example.com/a.png', max_size=10)
