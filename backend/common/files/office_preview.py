"""Safe PDF previews of private Office documents (employer papers, uploaded CVs)."""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.core.cache import cache

from common.storage.r2 import private_media_storage

DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
OFFICE_DOCUMENT_SUFFIXES = {
    'application/msword': '.doc',
    DOCX_CONTENT_TYPE: '.docx',
}
PREVIEW_TIMEOUT_SECONDS = 30
MAX_PREVIEW_BYTES = 25 * 1024 * 1024
# Bản PDF đã dựng được giữ ngắn hạn: mở lại cùng tệp (link chia sẻ, NTD xem lại)
# không chạy LibreOffice lần nữa. Trần kích thước để cache không phình vì tệp lớn;
# TTL ngắn để bản xem trước của tệp đã xóa không sống lâu hơn tệp gốc.
PREVIEW_CACHE_SECONDS = 10 * 60
PREVIEW_CACHE_MAX_BYTES = 4 * 1024 * 1024

logger = logging.getLogger(__name__)


def _soffice_env(home: Path) -> dict[str, str]:
    """Môi trường tối thiểu cho LibreOffice.

    Tệp đầu vào do người dùng tải lên (chưa qua quét virus): tiến trình chuyển đổi
    không được thừa hưởng SECRET_KEY, mật khẩu DB hay key R2 của web process.
    """
    return {
        'HOME': str(home),
        'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
        'LANG': 'C.UTF-8',
        'TMPDIR': str(home),
    }


def _render_source_to_pdf(source_path: Path) -> bytes | None:
    try:
        subprocess.run(
            [
                'soffice',
                (f'-env:UserInstallation={(source_path.parent / "libreoffice-profile").as_uri()}'),
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
                str(source_path.parent),
                str(source_path),
            ],
            check=False,
            env=_soffice_env(source_path.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=PREVIEW_TIMEOUT_SECONDS,
        )
        preview_path = source_path.with_suffix('.pdf')
        if not preview_path.is_file() or preview_path.stat().st_size > MAX_PREVIEW_BYTES:
            return None
        return preview_path.read_bytes()
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        logger.warning('Office document preview conversion failed.')
        return None


def _preview_cache_key(file_url: str) -> str:
    # Storage key là bí mật nội bộ: chỉ đưa bản băm vào key cache.
    return f'office-preview:v1:{hashlib.sha256(file_url.encode()).hexdigest()}'


def render_office_document_preview(file_url: str, content_type: str) -> bytes | None:
    """Render a supported private Office document to PDF without exposing its URL."""
    suffix = OFFICE_DOCUMENT_SUFFIXES.get(content_type)
    if not suffix:
        return None

    cache_key = _preview_cache_key(file_url)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    preview = _render_from_storage(file_url, suffix)
    if preview is not None and len(preview) <= PREVIEW_CACHE_MAX_BYTES:
        cache.set(cache_key, preview, PREVIEW_CACHE_SECONDS)
    return preview


def _render_from_storage(file_url: str, suffix: str) -> bytes | None:
    with tempfile.TemporaryDirectory(prefix='office-document-preview-') as directory:
        source_path = Path(directory) / f'source{suffix}'
        try:
            with (
                private_media_storage().open(file_url, 'rb') as source,
                source_path.open('wb') as target,
            ):
                shutil.copyfileobj(source, target)
        except OSError:
            logger.warning('Office document preview source could not be read.')
            return None
        return _render_source_to_pdf(source_path)
