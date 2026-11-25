import io
from http import HTTPStatus

from pypdf import PdfReader
from rest_framework.exceptions import APIException

from common.files.docx import LEGACY_DOCX_LIMITS, validate_docx_container
from common.files.images import open_bounded_image
from common.files.signatures import pdf_header_offset
from common.storage.r2 import private_media_storage


class EmployerUploadStructureError(ValueError):
    """A malware-clean object is still invalid for the employer parser boundary."""


class EmployerUploadSessionRejected(APIException):
    """Preserve safe shared-upload codes at an employer business boundary."""

    default_code = 'UPLOAD_INVALID_STATE'

    def __init__(self, error):
        self.status_code = {
            'RESOURCE_NOT_FOUND': HTTPStatus.NOT_FOUND,
            'UPLOAD_PIPELINE_DISABLED': HTTPStatus.SERVICE_UNAVAILABLE,
            'UPLOAD_EXPIRED': HTTPStatus.CONFLICT,
            'UPLOAD_NOT_CLEAN': HTTPStatus.CONFLICT,
            'UPLOAD_PURPOSE_MISMATCH': HTTPStatus.CONFLICT,
            'UPLOAD_ALREADY_SUBMITTED': HTTPStatus.CONFLICT,
        }.get(error.code, HTTPStatus.BAD_REQUEST)
        super().__init__(
            detail={
                'code': error.code,
                'message': error.message,
                'retryable': error.retryable,
            },
            code=error.code,
        )


DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
MAX_DOCUMENT_PDF_PAGES = 50
_IMAGE_FORMATS = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
}


def _validate_pdf_bytes(data):
    offset = pdf_header_offset(data)
    if offset < 0:
        raise EmployerUploadStructureError
    # Files with whitespace before the header measure their cross-reference
    # offsets from the header (the Acrobat convention), so parse from there.
    with io.BytesIO(data[offset:]) as document:
        reader = PdfReader(document, strict=True)
        if reader.is_encrypted or not reader.pages or len(reader.pages) > MAX_DOCUMENT_PDF_PAGES:
            raise EmployerUploadStructureError
        for page in reader.pages:
            if len(tuple(page.mediabox)) != 4:
                raise EmployerUploadStructureError


def _validate_image_stream(stream, content_type):
    with open_bounded_image(stream) as image:
        if image.format != _IMAGE_FORMATS.get(content_type):
            raise EmployerUploadStructureError
        image.verify()


def _validate_structure(stream, content_type):
    """Run the parser-boundary check for ``content_type``; parser errors stay inside."""
    try:
        if content_type == 'application/pdf':
            _validate_pdf_bytes(stream.read())
        elif content_type.startswith('image/'):
            _validate_image_stream(stream, content_type)
        elif content_type == DOCX_CONTENT_TYPE:
            validate_docx_container(stream, LEGACY_DOCX_LIMITS)
    except EmployerUploadStructureError:
        raise
    except Exception as error:  # noqa: BLE001 - parser detail must not cross the boundary
        raise EmployerUploadStructureError from error


def validate_employer_upload_structure(asset):
    """Validate clean bytes for the parser that will consume the business object."""
    if asset.content_type == 'application/pdf' or asset.content_type.startswith('image/'):
        try:
            source = private_media_storage().open(asset.storage_key, 'rb')
        except Exception as error:  # noqa: BLE001 - storage detail must not cross the boundary
            raise EmployerUploadStructureError from error
        with source:
            _validate_structure(source, asset.content_type)


def validate_employer_document_file(upload, content_type):
    """Same structure checks for a file posted directly (no scanner session)."""
    try:
        upload.seek(0)
        _validate_structure(upload, content_type)
    finally:
        upload.seek(0)
