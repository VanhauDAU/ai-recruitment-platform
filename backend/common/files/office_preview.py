"""Safe PDF previews of private Office documents (employer papers, uploaded CVs)."""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

from django.core.cache import cache

from common.storage.r2 import private_media_storage

DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
# Chỉ DOCX: .doc (OLE2) không kiểm vỏ được trước khi LibreOffice parse.
OFFICE_DOCUMENT_SUFFIXES = {DOCX_CONTENT_TYPE: '.docx'}
PREVIEW_TIMEOUT_SECONDS = 30
MAX_PREVIEW_BYTES = 25 * 1024 * 1024
# Bản PDF đã dựng được giữ ngắn hạn: mở lại cùng tệp (link chia sẻ, NTD xem lại)
# không chạy LibreOffice lần nữa. Trần kích thước để cache không phình vì tệp lớn;
# TTL ngắn để bản xem trước của tệp đã xóa không sống lâu hơn tệp gốc.
PREVIEW_CACHE_SECONDS = 10 * 60
PREVIEW_CACHE_MAX_BYTES = 4 * 1024 * 1024
# Mỗi lượt render tốn vài trăm MB RAM: giới hạn số lượt chạy cùng lúc trên toàn
# hệ thống bằng khóa trong cache dùng chung. Hết chỗ thì người gọi trả tệp gốc.
PREVIEW_MAX_CONCURRENT_RENDERS = 2
# Dài hơn thời gian chờ tối đa để khóa không hết hạn giữa chừng, và tự nhả nếu
# worker chết trước khi kịp xóa.
PREVIEW_SLOT_SECONDS = 2 * PREVIEW_TIMEOUT_SECONDS
# Thứ tự khớp với _LIMIT_SHIM. RLIMIT_AS đo trong image backend (LibreOffice
# 25.2, 11/2026): mẫu DPA thật cần ~0,5 GiB, lỗi ở 0,25 GiB; 2 GiB chừa dư cho
# tệp nặng hơn.
SOFFICE_RESOURCE_LIMITS = (
    2 * 1024**3,  # RLIMIT_AS: vùng nhớ ảo
    PREVIEW_TIMEOUT_SECONDS,  # RLIMIT_CPU: giây CPU
    100 * 1024**2,  # RLIMIT_FSIZE: tệp ghi ra lớn nhất
    256,  # RLIMIT_NOFILE
)
# Chạy bằng ``python -I -S``: đặt giới hạn cho chính tiến trình rồi exec soffice,
# nên mọi tiến trình con của LibreOffice thừa hưởng giới hạn. Không dùng
# ``preexec_fn`` vì gunicorn chạy đa luồng (fork trong luồng có thể kẹt khóa).
_LIMIT_SHIM = """
import os, resource, sys
address_space, cpu, file_size, open_files = (int(value) for value in sys.argv[1:5])
for limit, value in (
    (resource.RLIMIT_AS, address_space),
    (resource.RLIMIT_CPU, cpu),
    (resource.RLIMIT_FSIZE, file_size),
    (resource.RLIMIT_NOFILE, open_files),
    (resource.RLIMIT_CORE, 0),
):
    resource.setrlimit(limit, (value, value))
try:
    with open('/proc/self/oom_score_adj', 'w') as oom_score:
        oom_score.write('1000')
except OSError:
    pass
os.execvp(sys.argv[5], sys.argv[5:])
"""

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


def _soffice_command(source_path: Path) -> list[str]:
    return [
        sys.executable,
        '-I',
        '-S',
        '-c',
        _LIMIT_SHIM,
        *(str(value) for value in SOFFICE_RESOURCE_LIMITS),
        'soffice',
        f'-env:UserInstallation={(source_path.parent / "libreoffice-profile").as_uri()}',
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
    ]


def _kill_process_group(process: subprocess.Popen) -> None:
    # soffice là script khởi chạy oosplash → soffice.bin: giết cả nhóm để không sót con.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def _render_source_to_pdf(source_path: Path) -> bytes | None:
    try:
        process = subprocess.Popen(
            _soffice_command(source_path),
            env=_soffice_env(source_path.parent),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        logger.warning('Office document preview conversion could not start.')
        return None
    try:
        process.communicate(timeout=PREVIEW_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        logger.warning('Office document preview conversion timed out.')
        return None
    finally:
        _kill_process_group(process)
        process.wait()
    preview_path = source_path.with_suffix('.pdf')
    try:
        if not preview_path.is_file() or preview_path.stat().st_size > MAX_PREVIEW_BYTES:
            return None
        return preview_path.read_bytes()
    except OSError:
        logger.warning('Office document preview conversion failed.')
        return None


def _acquire_render_slot() -> str | None:
    for index in range(PREVIEW_MAX_CONCURRENT_RENDERS):
        key = f'office-preview:slot:{index}'
        if cache.add(key, 1, timeout=PREVIEW_SLOT_SECONDS):
            return key
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

    slot = _acquire_render_slot()
    if slot is None:
        logger.info('Office document preview skipped: every render slot is busy.')
        return None
    try:
        preview = _render_from_storage(file_url, suffix)
    finally:
        cache.delete(slot)
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
