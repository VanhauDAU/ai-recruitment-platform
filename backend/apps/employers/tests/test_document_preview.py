from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.employers.services import render_office_document_preview


class EmployerDocumentPreviewTests(SimpleTestCase):
    @patch('apps.employers.services.document_preview.subprocess.run')
    @patch('apps.employers.services.document_preview.private_media_storage')
    def test_renders_docx_to_pdf_without_exposing_the_private_source(
        self, storage_factory, soffice_run
    ):
        storage_factory.return_value.open.return_value = BytesIO(b'PK\x03\x04document')

        def create_pdf(command, **_kwargs):
            source_path = Path(command[-1])
            source_path.with_suffix('.pdf').write_bytes(b'%PDF-preview')

        soffice_run.side_effect = create_pdf

        preview = render_office_document_preview(
            'employers/rec_1/documents/agreement.docx',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        self.assertEqual(preview, b'%PDF-preview')
        storage_factory.return_value.open.assert_called_once_with(
            'employers/rec_1/documents/agreement.docx', 'rb'
        )
        self.assertIn('--safe-mode', soffice_run.call_args.args[0])
        self.assertTrue(
            soffice_run.call_args.args[0][1].startswith('-env:UserInstallation=file://')
        )

    @patch('apps.employers.services.document_preview.private_media_storage')
    def test_skips_conversion_for_a_format_without_a_safe_office_renderer(self, storage_factory):
        preview = render_office_document_preview(
            'employers/rec_1/document.xlsx', 'application/vnd.ms-excel'
        )

        self.assertIsNone(preview)
        storage_factory.assert_not_called()
