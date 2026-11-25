"""Ảnh nền catalogue CV: chuẩn hóa ảnh tải lên và lưu thành ``CvAsset`` công khai.

Ảnh nền thuộc catalogue (quản trị ở cv_templates) nhưng dùng chung bảng
``cvs.CvAsset`` với avatar, nên module ghi model đó và dùng quy tắc ảnh của
``cvs.domain``.
"""

from hashlib import sha256

from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.cvs.domain import CV_IMAGE_FORMATS, MAX_CV_IMAGE_BYTES
from apps.cvs.models import CvAsset
from common.files.images import UnsafeImage, open_bounded_image, reencode_image
from common.storage.r2 import public_media_storage


@transaction.atomic
def create_background_asset(*, upload, title='', is_active=True):
    if upload.size > MAX_CV_IMAGE_BYTES:
        raise ValidationError({'file': 'Image must be 5 MB or smaller.'})
    try:
        with open_bounded_image(upload) as image:
            if image.format not in CV_IMAGE_FORMATS:
                raise ValidationError({'file': 'Only JPEG, PNG, or WebP images are supported.'})
            encoded = reencode_image(image, max_size=(2480, 3508))
    except UnsafeImage as error:
        raise ValidationError({'file': 'Invalid image file.'}) from error
    extension, content_type = CV_IMAGE_FORMATS[encoded.format]
    payload = encoded.data
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
        width=encoded.width,
        height=encoded.height,
        checksum_sha256=checksum,
        is_active=is_active,
    )
    asset.full_clean()
    asset.save()
    return asset
