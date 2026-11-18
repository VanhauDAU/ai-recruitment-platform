"""Serve private proof documents to administrators.

Stored MIME types are often generic or aliased, so the type is resolved from
the file name before deciding between inline preview and download.
"""

import mimetypes
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from django.http import FileResponse, Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes

from common.files.office_preview import render_office_document_preview
from common.storage.r2 import private_media_storage

GENERIC_CONTENT_TYPES = {'', 'application/octet-stream', 'binary/octet-stream'}
CONTENT_TYPE_ALIASES = {
    'application/x-pdf': 'application/pdf',
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'image/x-png': 'image/png',
}
CONTENT_TYPES_BY_EXTENSION = {
    'avif': 'image/avif',
    'bmp': 'image/bmp',
    'csv': 'text/csv',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'gif': 'image/gif',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'json': 'application/json',
    'pdf': 'application/pdf',
    'png': 'image/png',
    'svg': 'image/svg+xml',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'txt': 'text/plain',
    'webp': 'image/webp',
    'xml': 'application/xml',
}
DOCUMENT_PUBLIC_ID_PARAMETER = OpenApiParameter(
    'document_public_id', str, OpenApiParameter.PATH, description='public_id của giấy tờ'
)
DOCUMENT_CONTENT_RESPONSE = {(200, 'application/octet-stream'): OpenApiTypes.BINARY}


def _content_type_from_file_name(value):
    path = urlsplit(value or '').path
    extension = PurePosixPath(path).suffix.lower().lstrip('.')
    return CONTENT_TYPES_BY_EXTENSION.get(extension)


def _document_content_type(document):
    stored_type = (document.mime_type or '').partition(';')[0].strip().lower()
    if stored_type not in GENERIC_CONTENT_TYPES:
        return CONTENT_TYPE_ALIASES.get(stored_type, stored_type)
    for candidate in (document.file_name, document.file_url):
        explicit_type = _content_type_from_file_name(candidate)
        if explicit_type:
            return explicit_type
        guessed_type, _ = mimetypes.guess_type(candidate or '')
        if guessed_type:
            return CONTENT_TYPE_ALIASES.get(guessed_type, guessed_type)
    return 'application/octet-stream'


def _supports_inline_preview(content_type):
    return (
        content_type == 'application/pdf'
        or content_type.startswith('image/')
        or content_type.startswith('text/')
        or content_type in {'application/json', 'application/xml'}
    )


def private_document_response(document, *, render_preview):
    """Stream ``document`` from private storage, or its PDF rendering for Office files.

    Office files cannot be shown inline by a browser, so when ``render_preview``
    is set they are converted to PDF; everything else is streamed as stored.
    """
    content_type = _document_content_type(document)
    if render_preview:
        preview = render_office_document_preview(document.file_url, content_type)
        if preview is not None:
            return FileResponse(
                BytesIO(preview),
                content_type='application/pdf',
                filename=f'{document.public_id}.pdf',
                as_attachment=False,
            )
    try:
        stream = private_media_storage().open(document.file_url, 'rb')
    except (FileNotFoundError, OSError) as error:
        raise Http404 from error
    response = FileResponse(
        stream,
        content_type=content_type,
        filename=document.file_name or f'{document.public_id}.bin',
        as_attachment=not _supports_inline_preview(content_type),
    )
    response['Cache-Control'] = 'private, no-store'
    return response
