import io

from PIL import Image
from pypdf import PdfReader

from common.file_signatures import pdf_header_offset
from common.r2_storage import private_media_storage


class EmployerUploadStructureError(ValueError):
    """A malware-clean object is still invalid for the employer parser boundary."""


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
