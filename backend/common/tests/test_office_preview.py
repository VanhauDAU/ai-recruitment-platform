import signal
import subprocess
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import SimpleTestCase

from common.files.office_preview import (
    DOCX_CONTENT_TYPE,
    PREVIEW_MAX_CONCURRENT_RENDERS,
    render_office_document_preview,
)


def _soffice_args(command):
    """The soffice command line after the resource-limit shim's arguments."""
    return command[command.index('soffice') :]


def _fake_popen(*, writes_pdf=True, timeout=False):
    def popen(command, **_kwargs):
        process = MagicMock(pid=4242)
        if writes_pdf:
            Path(command[-1]).with_suffix('.pdf').write_bytes(b'%PDF-preview')
        if timeout:
            process.communicate.side_effect = subprocess.TimeoutExpired(command, 30)
        return process

    return popen


@patch('common.files.office_preview.os.killpg')
@patch('common.files.office_preview.private_media_storage')
class OfficeDocumentPreviewTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def _render(self, storage_factory, file_url='cvs/1/source.docx'):
        storage_factory.return_value.open.side_effect = lambda *_args: BytesIO(b'PK\x03\x04doc')
        return render_office_document_preview(file_url, DOCX_CONTENT_TYPE)

    @patch('common.files.office_preview.subprocess.Popen', side_effect=_fake_popen())
    def test_renders_docx_to_pdf_without_exposing_the_private_source(
        self, popen, storage_factory, _killpg
    ):
        preview = self._render(storage_factory, 'employers/rec_1/documents/agreement.docx')

        self.assertEqual(preview, b'%PDF-preview')
        storage_factory.return_value.open.assert_called_once_with(
            'employers/rec_1/documents/agreement.docx', 'rb'
        )
        soffice = _soffice_args(popen.call_args.args[0])
        self.assertIn('--safe-mode', soffice)
        self.assertTrue(soffice[1].startswith('-env:UserInstallation=file://'))

    @patch('common.files.office_preview.subprocess.Popen', side_effect=_fake_popen())
    def test_soffice_runs_in_its_own_session_behind_the_resource_limit_shim(
        self, popen, storage_factory, killpg
    ):
        self._render(storage_factory)

        command = popen.call_args.args[0]
        self.assertEqual(command[1:4], ['-I', '-S', '-c'])
        self.assertIn('RLIMIT_AS', command[4])
        self.assertIn('oom_score_adj', command[4])
        self.assertEqual(command[5:9], [str(2 * 1024**3), '30', str(100 * 1024**2), '256'])
        self.assertTrue(popen.call_args.kwargs['start_new_session'])
        self.assertNotIn('preexec_fn', popen.call_args.kwargs)
        # Dọn cả nhóm tiến trình kể cả khi soffice thoát bình thường.
        killpg.assert_called_once_with(4242, signal.SIGKILL)

    @patch(
        'common.files.office_preview.subprocess.Popen',
        side_effect=_fake_popen(writes_pdf=False, timeout=True),
    )
    def test_timeout_kills_the_whole_process_group_and_falls_back(
        self, popen, storage_factory, killpg
    ):
        self.assertIsNone(self._render(storage_factory))

        killpg.assert_called_once_with(4242, signal.SIGKILL)
        self.assertIsNone(cache.get('office-preview:slot:0'))

    @patch('common.files.office_preview.subprocess.Popen', side_effect=_fake_popen())
    def test_busy_render_slots_skip_conversion(self, popen, storage_factory, _killpg):
        for index in range(PREVIEW_MAX_CONCURRENT_RENDERS):
            cache.add(f'office-preview:slot:{index}', 1, timeout=60)

        self.assertIsNone(self._render(storage_factory))

        popen.assert_not_called()
        storage_factory.return_value.open.assert_not_called()

    @patch('common.files.office_preview.subprocess.Popen', side_effect=_fake_popen())
    def test_render_slot_is_released_after_conversion(self, _popen, storage_factory, _killpg):
        self._render(storage_factory)

        self.assertIsNone(cache.get('office-preview:slot:0'))

    def test_skips_conversion_for_a_format_without_a_safe_office_renderer(
        self, storage_factory, _killpg
    ):
        for content_type in ('application/vnd.ms-excel', 'application/msword'):
            with self.subTest(content_type=content_type):
                preview = render_office_document_preview('employers/rec_1/document', content_type)

                self.assertIsNone(preview)
        storage_factory.assert_not_called()

    @patch.dict('os.environ', {'SECRET_KEY': 'web-secret', 'DB_PASSWORD': 'db-secret'})
    @patch('common.files.office_preview.subprocess.Popen', side_effect=_fake_popen())
    def test_libreoffice_does_not_inherit_web_process_secrets(
        self, popen, storage_factory, _killpg
    ):
        self._render(storage_factory)

        env = popen.call_args.kwargs['env']
        self.assertNotIn('SECRET_KEY', env)
        self.assertNotIn('DB_PASSWORD', env)
        self.assertEqual(set(env), {'HOME', 'PATH', 'LANG', 'TMPDIR'})

    @patch('common.files.office_preview.subprocess.Popen', side_effect=_fake_popen())
    def test_reopening_the_same_document_reuses_the_rendered_pdf(
        self, popen, storage_factory, _killpg
    ):
        first = self._render(storage_factory)
        second = self._render(storage_factory)

        self.assertEqual(first, second)
        self.assertEqual(popen.call_count, 1)
