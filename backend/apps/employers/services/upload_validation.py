import io
from http import HTTPStatus

from PIL import Image
from pypdf import PdfReader
from rest_framework.exceptions import APIException

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


def _validate_pdf(storage_key):
    try:
        with private_media_storage().open(storage_key, 'rb') as source:
            data = source.read()
        offset = pdf_header_offset(data)
        if offset < 0:
            raise EmployerUploadStructureError
        # Files with whitespace before the header measure their cross-reference
        # offsets from the header (the Acrobat convention), so parse from there.
        with io.BytesIO(data[offset:]) as document:
            reader = PdfReader(document, strict=True)
            if reader.is_encrypted or not reader.pages:
                raise EmployerUploadStructureError
            for page in reader.pages:
                if len(tuple(page.mediabox)) != 4:
                    raise EmployerUploadStructureError
    except EmployerUploadStructureError:
        raise
    except Exception as error:  # noqa: BLE001 - parser detail must not cross the boundary
        raise EmployerUploadStructureError from error


def _validate_image(storage_key, content_type):
    expected_formats = {
        'image/jpeg': {'JPEG'},
        'image/png': {'PNG'},
        'image/webp': {'WEBP'},
    }
    try:
        with private_media_storage().open(storage_key, 'rb') as source:
            with Image.open(source) as image:
                if image.format not in expected_formats.get(content_type, set()):
                    raise EmployerUploadStructureError
                image.verify()
    except EmployerUploadStructureError:
        raise
    except Exception as error:  # noqa: BLE001 - parser detail must not cross the boundary
        raise EmployerUploadStructureError from error


def validate_employer_upload_structure(asset):
    """Validate clean bytes for the parser that will consume the business object."""
    if asset.content_type == 'application/pdf':
        _validate_pdf(asset.storage_key)
    elif asset.content_type.startswith('image/'):
        _validate_image(asset.storage_key, asset.content_type)
