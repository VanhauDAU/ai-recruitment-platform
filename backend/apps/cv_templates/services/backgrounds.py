"""Ảnh nền catalogue CV: chuẩn hóa ảnh tải lên và lưu thành ``CvAsset`` công khai.

Ảnh nền thuộc catalogue (quản trị ở cv_templates) nhưng dùng chung bảng
``cvs.CvAsset`` với avatar, nên module ghi model đó và dùng quy tắc ảnh của
``cvs.domain``.
"""

from hashlib import sha256
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError

from apps.cvs.domain import CV_IMAGE_FORMATS, MAX_CV_IMAGE_BYTES
from apps.cvs.models import CvAsset
from common.storage.r2 import public_media_storage


@transaction.atomic
def create_background_asset(*, upload, title='', is_active=True):
    if upload.size > MAX_CV_IMAGE_BYTES:
        raise ValidationError({'file': 'Image must be 5 MB or smaller.'})
    try:
        upload.seek(0)
        image = Image.open(upload)
        detected_format = image.format
        image.verify()
        upload.seek(0)
        image = Image.open(upload)
        image = ImageOps.exif_transpose(image)
        image.load()
    except (OSError, ValueError) as error:
        raise ValidationError({'file': 'Invalid image file.'}) from error
    if detected_format not in CV_IMAGE_FORMATS:
        raise ValidationError({'file': 'Only JPEG, PNG, or WebP images are supported.'})
    extension, content_type = CV_IMAGE_FORMATS[detected_format]
    image.thumbnail((2480, 3508), Image.Resampling.LANCZOS)
    if detected_format == 'JPEG' and image.mode not in {'RGB', 'L'}:
        image = image.convert('RGB')
    buffer = BytesIO()
    image.save(buffer, format=detected_format, optimize=True)
    payload = buffer.getvalue()
    checksum = sha256(payload).hexdigest()
    storage_key = public_media_storage().save(
        f'cvs/backgrounds/{checksum}.{extension}',
        ContentFile(payload),
    )
    asset = CvAsset(
        owner=None,
        kind=CvAsset.Kind.BACKGROUND,
        title=title.strip(),
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=len(payload),
        width=image.width,
        height=image.height,
        checksum_sha256=checksum,
        is_active=is_active,
    )
    asset.full_clean()
    asset.save()
    return asset
