"""Safe, private preview rendering for employer verification documents."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from common.r2_storage import private_media_storage

OFFICE_DOCUMENT_SUFFIXES = {
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}
PREVIEW_TIMEOUT_SECONDS = 30
MAX_PREVIEW_BYTES = 25 * 1024 * 1024

logger = logging.getLogger(__name__)


def render_office_document_preview(file_url: str, content_type: str) -> bytes | None:
    """Render a supported private Office document to PDF without exposing its URL."""
    suffix = OFFICE_DOCUMENT_SUFFIXES.get(content_type)
    if not suffix:
        return None

    try:
        with tempfile.TemporaryDirectory(prefix='employer-document-preview-') as directory:
            workdir = Path(directory)
            source_path = workdir / f'source{suffix}'
            with (
                private_media_storage().open(file_url, 'rb') as source,
                source_path.open('wb') as target,
            ):
                shutil.copyfileobj(source, target)

            subprocess.run(
                [
                    'soffice',
                    '--headless',
                    '--nologo',
                    '--nodefault',
                    '--nolockcheck',
                    '--nofirststartwizard',
                    '--norestore',
                    '--safe-mode',
                    '--convert-to',
                    'pdf',
                    '--outdir',
                    str(workdir),
                    str(source_path),
                ],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=PREVIEW_TIMEOUT_SECONDS,
            )
            preview_path = source_path.with_suffix('.pdf')
            if not preview_path.is_file() or preview_path.stat().st_size > MAX_PREVIEW_BYTES:
                return None
            return preview_path.read_bytes()
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        logger.warning('Employer verification office preview conversion failed.')
        return None
