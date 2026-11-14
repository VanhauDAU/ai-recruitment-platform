from django.test import SimpleTestCase

from common.file_signatures import SIGNATURE_WINDOW_BYTES, has_pdf_header


class PdfHeaderTests(SimpleTestCase):
    def test_header_may_follow_whitespace_or_bom(self):
        for prefix in (b'', b'\n', b'\r\n', b'\x00 \t', b'\xef\xbb\xbf'):
            with self.subTest(prefix=prefix):
                self.assertTrue(has_pdf_header(prefix + b'%PDF-1.7\n'))

    def test_other_content_before_the_header_is_rejected(self):
        for prefix in (b'GIF89a', b'PK\x03\x04', b'<html>', b'x'):
            with self.subTest(prefix=prefix):
                self.assertFalse(has_pdf_header(prefix + b'%PDF-1.7\n'))

    def test_header_outside_the_signature_window_is_rejected(self):
        self.assertFalse(has_pdf_header(b'\n' * SIGNATURE_WINDOW_BYTES + b'%PDF-1.7'))
