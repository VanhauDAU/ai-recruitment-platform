from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from ..services.upload_validation import (
    EmployerUploadStructureError,
    validate_employer_document_file,
    validate_employer_upload_structure,
)
from .factories import PNG_BYTES, pdf_bytes


class _Storage:
    def __init__(self, payload):
        self.payload = payload

    def open(self, _key, _mode):
        return BytesIO(self.payload)


class EmployerUploadStructureTests(SimpleTestCase):
    def _validate_scanned(self, payload, content_type):
        asset = SimpleNamespace(storage_key='private/key', content_type=content_type)
        with patch(
            'apps.employers.services.upload_validation.private_media_storage',
            return_value=_Storage(payload),
        ):
            validate_employer_upload_structure(asset)

    def _validate_both_paths(self, payload, content_type):
        self._validate_scanned(payload, content_type)
        validate_employer_document_file(BytesIO(payload), content_type)

    def test_pdf_with_whitespace_before_the_header_is_accepted(self):
        for prefix in (b'', b'\n', b'\xef\xbb\xbf'):
            with self.subTest(prefix=prefix):
                self._validate_both_paths(prefix + pdf_bytes(), 'application/pdf')

    def test_valid_png_is_accepted(self):
        self._validate_both_paths(PNG_BYTES, 'image/png')

    def test_invalid_structure_is_rejected_on_both_paths(self):
        cases = (
            (b'GIF89a' + pdf_bytes(), 'application/pdf'),
            (b'%PDF-1.7\nnot really a pdf', 'application/pdf'),
            (pdf_bytes(password='secret'), 'application/pdf'),
            (pdf_bytes(pages=51), 'application/pdf'),
            (PNG_BYTES[:40], 'image/png'),
            (PNG_BYTES, 'image/jpeg'),
        )
        for payload, content_type in cases:
            for validate in (self._validate_scanned, validate_employer_document_file):
                with (
                    self.subTest(content_type=content_type, size=len(payload), path=validate),
                    self.assertRaises(EmployerUploadStructureError),
                ):
                    stream = payload if validate is self._validate_scanned else BytesIO(payload)
                    validate(stream, content_type)
