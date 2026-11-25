"""Kiểm vỏ ZIP của DOCX trước khi bất kỳ parser Office nào chạm vào nội dung.

Chỉ đọc bảng mục lục (central directory) của ZIP: không giải nén, không parse
XML. Mọi đường nhận DOCX (upload qua phiên quét, nhập CV, giấy tờ NTD đường
cũ) dùng chung hàm này để chặn zip-bomb, path traversal, symlink và mục mã hóa
trước khi python-docx/LibreOffice mở tệp.
"""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

DOCX_REQUIRED_PARTS = frozenset({'[Content_Types].xml', 'word/document.xml'})
DOCX_MAIN_DOCUMENT_PART = 'word/document.xml'
_SYMLINK_MODE = 0o120000
_FILE_TYPE_MASK = 0o170000


class UnsafeDocxContainer(ValueError):
    """Vỏ ZIP không phải DOCX hợp lệ hoặc vượt giới hạn an toàn."""


@dataclass(frozen=True)
class DocxLimits:
    max_entries: int
    max_uncompressed_bytes: int
    max_document_xml_bytes: int
    max_compression_ratio: float


# Đường cũ (multipart trực tiếp, không qua quét) giải nén đồng bộ trong web
# process bằng python-docx, nên trần chặt hơn pipeline upload: CV/DPA thật chỉ
# vài chục mục và vài MB XML.
LEGACY_DOCX_LIMITS = DocxLimits(
    max_entries=300,
    max_uncompressed_bytes=30 * 1024 * 1024,
    max_document_xml_bytes=10 * 1024 * 1024,
    max_compression_ratio=100,
)


def _exceeds_ratio(uncompressed, compressed, limit):
    return bool(uncompressed) and (compressed == 0 or uncompressed / compressed > limit)


def _check_entry(entry, names):
    name = entry.filename
    path = PurePosixPath(name)
    if (
        not name
        or '\x00' in name
        or '\\' in name
        or name.startswith('/')
        or '..' in path.parts
        or entry.flag_bits & 0x1
        or entry.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}
    ):
        raise UnsafeDocxContainer
    normalised_name = path.as_posix()
    if normalised_name in names or any(':' in part for part in path.parts):
        raise UnsafeDocxContainer
    unix_mode = entry.external_attr >> 16
    if unix_mode and (unix_mode & _FILE_TYPE_MASK) == _SYMLINK_MODE:
        raise UnsafeDocxContainer
    return normalised_name


def validate_docx_container(stream, limits: DocxLimits):
    """Từ chối ``stream`` nếu vỏ ZIP không an toàn; luôn tua stream về đầu."""
    try:
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            entries = archive.infolist()
            if not entries or len(entries) > limits.max_entries:
                raise UnsafeDocxContainer
            names = set()
            total_uncompressed = 0
            total_compressed = 0
            for entry in entries:
                name = _check_entry(entry, names)
                names.add(name)
                total_uncompressed += entry.file_size
                total_compressed += entry.compress_size
                if (
                    total_uncompressed > limits.max_uncompressed_bytes
                    or (
                        name == DOCX_MAIN_DOCUMENT_PART
                        and entry.file_size > limits.max_document_xml_bytes
                    )
                    or _exceeds_ratio(
                        entry.file_size, entry.compress_size, limits.max_compression_ratio
                    )
                ):
                    raise UnsafeDocxContainer
            if _exceeds_ratio(total_uncompressed, total_compressed, limits.max_compression_ratio):
                raise UnsafeDocxContainer
            if not DOCX_REQUIRED_PARTS.issubset(names):
                raise UnsafeDocxContainer
    except UnsafeDocxContainer:
        raise
    except (OSError, ValueError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        raise UnsafeDocxContainer from exc
    finally:
        stream.seek(0)
