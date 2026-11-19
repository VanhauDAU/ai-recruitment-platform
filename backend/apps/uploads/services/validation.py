"""Fail-closed validation of upload metadata and payload bytes."""

from __future__ import annotations

import re
import zipfile
from hashlib import sha256
from pathlib import PurePosixPath
from tempfile import SpooledTemporaryFile

from django.conf import settings

from common.files.signatures import (
    SIGNATURE_WINDOW_BYTES,
    ZIP_SIGNATURE,
    has_pdf_header,
    image_content_type,
)

from .errors import upload_error

PURPOSE_PATTERN = re.compile(r'^[a-z][a-z0-9_.-]{1,63}$')


REFERENCE_PATTERN = re.compile(r'^[A-Za-z0-9_.:-]{1,64}$')


DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def _allowed_purposes():
    return frozenset(settings.UPLOAD_SESSION_ALLOWED_PURPOSES)


def normalise_purpose(value):
    purpose = str(value or '').strip().lower()
    if not PURPOSE_PATTERN.fullmatch(purpose):
        raise upload_error('UPLOAD_INVALID_METADATA')
    if purpose not in _allowed_purposes():
        raise upload_error('UPLOAD_PURPOSE_NOT_ALLOWED')
    return purpose


def safe_filename(value):
    name = str(value or '').replace('\\', '/').rsplit('/', 1)[-1].strip()
    name = ''.join(character for character in name if character.isprintable())
    if not name or len(name) > 255 or name in {'.', '..'}:
        raise upload_error('UPLOAD_INVALID_METADATA')
    return name


def normalise_content_type(value):
    content_type = str(value or '').partition(';')[0].strip().lower()
    aliases = {'image/jpg': 'image/jpeg'}
    return aliases.get(content_type, content_type)


def validate_reference(value):
    reference = str(value or '').strip()
    if not REFERENCE_PATTERN.fullmatch(reference):
        raise upload_error('UPLOAD_INVALID_METADATA')
    return reference


def _detect_content_type(header):
    if has_pdf_header(header):
        return 'application/pdf'
    if header.startswith(ZIP_SIGNATURE):
        return DOCX_CONTENT_TYPE
    return image_content_type(header)


def _validate_docx_container(stream):
    """Inspect bounded ZIP metadata only; never extract or parse Office content."""
    try:
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            entries = archive.infolist()
            if not entries or len(entries) > settings.UPLOAD_DOCX_MAX_ENTRIES:
                raise upload_error('UPLOAD_CONTENT_MISMATCH')
            names = set()
            total_uncompressed = 0
            total_compressed = 0
            for entry in entries:
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
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                normalised_name = path.as_posix()
                if normalised_name in names or any(':' in part for part in path.parts):
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                unix_mode = entry.external_attr >> 16
                if unix_mode and (unix_mode & 0o170000) == 0o120000:
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                names.add(normalised_name)
                total_uncompressed += entry.file_size
                total_compressed += entry.compress_size
                if total_uncompressed > settings.UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES:
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
                if entry.file_size and (
                    entry.compress_size == 0
                    or entry.file_size / entry.compress_size
                    > settings.UPLOAD_DOCX_MAX_COMPRESSION_RATIO
                ):
                    raise upload_error('UPLOAD_CONTENT_MISMATCH')
            if total_uncompressed and (
                total_compressed == 0
                or total_uncompressed / total_compressed
                > settings.UPLOAD_DOCX_MAX_COMPRESSION_RATIO
            ):
                raise upload_error('UPLOAD_CONTENT_MISMATCH')
            if not {'[Content_Types].xml', 'word/document.xml'}.issubset(names):
                raise upload_error('UPLOAD_CONTENT_MISMATCH')
    except (OSError, ValueError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        raise upload_error('UPLOAD_CONTENT_MISMATCH') from exc


def spool_and_validate(upload, *, session):
    upload_name = safe_filename(getattr(upload, 'name', ''))
    if upload_name != session.original_filename:
        raise upload_error('UPLOAD_INVALID_METADATA')
    upload_type = normalise_content_type(getattr(upload, 'content_type', ''))
    if upload_type != session.declared_content_type:
        raise upload_error('UPLOAD_CONTENT_MISMATCH')

    temporary = SpooledTemporaryFile(
        max_size=settings.UPLOAD_SPOOL_MEMORY_BYTES,
        mode='w+b',
    )
    digest = sha256()
    size = 0
    header = bytearray()
    try:
        chunks = (
            upload.chunks()
            if hasattr(upload, 'chunks')
            else iter(lambda: upload.read(1024**2), b'')
        )
        for chunk in chunks:
            if not chunk:
                continue
            size += len(chunk)
            if size > settings.UPLOAD_MAX_BYTES:
                raise upload_error('UPLOAD_TOO_LARGE')
            if len(header) < SIGNATURE_WINDOW_BYTES:
                header.extend(chunk[: SIGNATURE_WINDOW_BYTES - len(header)])
            digest.update(chunk)
            temporary.write(chunk)
        if size != session.expected_size_bytes:
            raise upload_error('UPLOAD_CONTENT_MISMATCH')
        detected_type = _detect_content_type(bytes(header))
        if detected_type != session.declared_content_type:
            raise upload_error('UPLOAD_CONTENT_MISMATCH')
        if detected_type == DOCX_CONTENT_TYPE:
            _validate_docx_container(temporary)
        temporary.seek(0)
        return temporary, size, digest.hexdigest(), detected_type
    except Exception:
        temporary.close()
        raise
