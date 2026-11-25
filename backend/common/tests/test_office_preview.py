from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from common.files.office_preview import DOCX_CONTENT_TYPE, render_office_document_preview


def _create_pdf(command, **_kwargs):
    Path(command[-1]).with_suffix('.pdf').write_bytes(b'%PDF-preview')


class OfficeDocumentPreviewTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    @patch('common.files.office_preview.subprocess.run')
    @patch('common.files.office_preview.private_media_storage')
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

    @patch('common.files.office_preview.private_media_storage')
    def test_skips_conversion_for_a_format_without_a_safe_office_renderer(self, storage_factory):
        preview = render_office_document_preview(
            'employers/rec_1/document.xlsx', 'application/vnd.ms-excel'
        )

        self.assertIsNone(preview)
        storage_factory.assert_not_called()

    @patch.dict('os.environ', {'SECRET_KEY': 'web-secret', 'DB_PASSWORD': 'db-secret'})
    @patch('common.files.office_preview.subprocess.run', side_effect=_create_pdf)
    @patch('common.files.office_preview.private_media_storage')
    def test_libreoffice_does_not_inherit_web_process_secrets(self, storage_factory, soffice_run):
        storage_factory.return_value.open.return_value = BytesIO(b'PK\x03\x04document')

        render_office_document_preview('cvs/1/source.docx', DOCX_CONTENT_TYPE)

        env = soffice_run.call_args.kwargs['env']
        self.assertNotIn('SECRET_KEY', env)
        self.assertNotIn('DB_PASSWORD', env)
        self.assertEqual(set(env), {'HOME', 'PATH', 'LANG', 'TMPDIR'})

    @patch('common.files.office_preview.subprocess.run', side_effect=_create_pdf)
    @patch('common.files.office_preview.private_media_storage')
    def test_reopening_the_same_document_reuses_the_rendered_pdf(
        self, storage_factory, soffice_run
    ):
        storage_factory.return_value.open.side_effect = lambda *_args: BytesIO(b'PK\x03\x04doc')

        first = render_office_document_preview('cvs/1/source.docx', DOCX_CONTENT_TYPE)
        second = render_office_document_preview('cvs/1/source.docx', DOCX_CONTENT_TYPE)

        self.assertEqual(first, second)
        self.assertEqual(soffice_run.call_count, 1)
