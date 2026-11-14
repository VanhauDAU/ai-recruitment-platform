import io
from unittest.mock import patch

from django.test import SimpleTestCase
from pypdf import PdfWriter

from ..services.upload_validation import EmployerUploadStructureError, _validate_pdf


def _pdf_bytes():
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class _Storage:
    def __init__(self, payload):
        self.payload = payload

    def open(self, _key, _mode):
        return io.BytesIO(self.payload)


class PdfStructureValidationTests(SimpleTestCase):
    def _validate(self, payload):
        with patch(
            'apps.employers.services.upload_validation.private_media_storage',
            return_value=_Storage(payload),
        ):
            _validate_pdf('private/key.pdf')

    def test_pdf_with_whitespace_before_the_header_is_accepted(self):
        for prefix in (b'', b'\n', b'\xef\xbb\xbf'):
            with self.subTest(prefix=prefix):
                self._validate(prefix + _pdf_bytes())

    def test_content_that_is_not_a_pdf_is_rejected(self):
        for payload in (b'GIF89a' + _pdf_bytes(), b'%PDF-1.7\nnot really a pdf'):
            with self.subTest(payload=payload[:8]), self.assertRaises(EmployerUploadStructureError):
                self._validate(payload)
