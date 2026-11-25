"""Fail-closed validation of upload metadata and payload bytes."""

from __future__ import annotations

import re
from hashlib import sha256
from tempfile import SpooledTemporaryFile

from django.conf import settings

from common.files.docx import DocxLimits, UnsafeDocxContainer, validate_docx_container
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


# python-docx và LibreOffice dựng DOM cho cả phần thân trong bộ nhớ.
UPLOAD_DOCX_MAX_DOCUMENT_XML_BYTES = 25 * 1024 * 1024


def _validate_docx_container(stream):
    """Inspect bounded ZIP metadata only; never extract or parse Office content."""
    limits = DocxLimits(
        max_entries=settings.UPLOAD_DOCX_MAX_ENTRIES,
        max_uncompressed_bytes=settings.UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES,
        max_document_xml_bytes=UPLOAD_DOCX_MAX_DOCUMENT_XML_BYTES,
        max_compression_ratio=settings.UPLOAD_DOCX_MAX_COMPRESSION_RATIO,
    )
    try:
        validate_docx_container(stream, limits)
    except UnsafeDocxContainer as exc:
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
