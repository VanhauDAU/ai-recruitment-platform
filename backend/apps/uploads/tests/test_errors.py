from unittest.mock import patch

from django.test import SimpleTestCase

from common.api.exceptions import api_exception_handler

from ..services import enqueue_upload_scan, upload_error


class UploadErrorContractTests(SimpleTestCase):
    def test_domain_error_maps_code_to_status_and_safe_payload(self):
        for code, expected in (
            ('RESOURCE_NOT_FOUND', 404),
            ('UPLOAD_TOO_LARGE', 413),
            ('UPLOAD_BUSY', 409),
            ('UPLOAD_CONTENT_MISMATCH', 400),
        ):
            with self.subTest(code=code):
                response = api_exception_handler(upload_error(code), {})
                self.assertEqual(response.status_code, expected)
                self.assertEqual(set(response.data), {'code', 'message', 'retryable'})
                self.assertEqual(response.data['code'], code)

    @patch('apps.uploads.tasks.scan_upload_session.delay', side_effect=ConnectionError)
    def test_enqueue_scan_swallows_broker_errors(self, delay):
        with self.assertLogs('apps.uploads.services.sessions', level='WARNING'):
            enqueue_upload_scan(42)
        delay.assert_called_once_with(42)
