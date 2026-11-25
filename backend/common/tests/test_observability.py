import json
import logging
import sys
from unittest import TestCase

from common.log_format import JsonLineFormatter
from common.sentry import scrub_event


class JsonLineFormatterTests(TestCase):
    def test_one_json_line_with_traceback(self):
        try:
            raise ValueError('hỏng')
        except ValueError:
            record = logging.LogRecord(
                'apps.demo', logging.ERROR, __file__, 1, 'Lỗi %s', ('x',), sys.exc_info()
            )

        line = JsonLineFormatter().format(record)

        self.assertNotIn('\n', line)
        payload = json.loads(line)
        self.assertEqual(payload['level'], 'ERROR')
        self.assertEqual(payload['logger'], 'apps.demo')
        self.assertEqual(payload['message'], 'Lỗi x')
        self.assertIn('ValueError: hỏng', payload['exc_info'])


class SentryScrubTests(TestCase):
    def test_removes_body_cookies_query_and_auth_headers(self):
        event = scrub_event(
            {
                'request': {
                    'url': 'https://procv.site/api/auth/login/',
                    'data': {'password': 'secret'},
                    'cookies': {'refresh': 'token'},
                    'query_string': 'token=abc',
                    'headers': {
                        'Authorization': 'Bearer abc',
                        'Cookie': 'a=b',
                        'X-CSRFToken': 'csrf',
                        'User-Agent': 'Mozilla',
                    },
                }
            }
        )

        request = event['request']
        self.assertNotIn('data', request)
        self.assertNotIn('cookies', request)
        self.assertEqual(request['query_string'], '[Filtered]')
        self.assertEqual(
            request['headers'],
            {
                'Authorization': '[Filtered]',
                'Cookie': '[Filtered]',
                'X-CSRFToken': '[Filtered]',
                'User-Agent': 'Mozilla',
            },
        )

    def test_event_without_request_is_returned_unchanged(self):
        event = {'message': 'boom'}
        self.assertIs(scrub_event(event), event)
