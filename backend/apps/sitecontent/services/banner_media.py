"""Upload ảnh banner (carousel trang chủ và các vị trí banner khác)."""

from django.utils.translation import gettext as _
from PIL import Image
from rest_framework.exceptions import ValidationError

from common.storage.media import save_image_upload, validate_image_upload

from ..models import Banner

BANNER_DIRECTORY = 'site/banners'
BANNER_MAX_SIDE = 2400
# Slide "ảnh + link" của carousel trang chủ: khuyến nghị 1600×600 (8:3).
HERO_IMAGE_MAX_BYTES = 1536 * 1024
HERO_IMAGE_MIN_SIZE = (1200, 450)
HERO_IMAGE_RATIO = (2.4, 3.0)
DEFAULT_MAX_BYTES = 1024 * 1024
DEFAULT_MIN_SIZE = (400, 200)


def _rules(placement, kind):
    if placement == Banner.Placement.HOME_HERO and kind == Banner.Kind.IMAGE:
        return HERO_IMAGE_MAX_BYTES, HERO_IMAGE_MIN_SIZE, HERO_IMAGE_RATIO
    return DEFAULT_MAX_BYTES, DEFAULT_MIN_SIZE, None


def upload_banner_image(*, upload, placement, kind, request=None):
    """Kiểm tra dung lượng, kích thước, tỉ lệ rồi lưu vào public media."""
    if upload is None:
        raise ValidationError({'file': _('Chọn file ảnh.')})
    max_bytes, (min_width, min_height), ratio = _rules(placement, kind)
    if getattr(upload, 'size', 0) > max_bytes:
        raise ValidationError({'file': _('Ảnh tối đa %(size)s KB.') % {'size': max_bytes // 1024}})
    validate_image_upload(upload)

    upload.seek(0)
    try:
        with Image.open(upload) as image:
            width, height = image.size
            is_gif = image.format == 'GIF'
    except OSError as error:
        raise ValidationError({'file': _('Không đọc được file ảnh.')}) from error
    finally:
        upload.seek(0)

    if is_gif:
        raise ValidationError({'file': _('Chỉ nhận ảnh JPEG, PNG hoặc WebP.')})
    if width < min_width or height < min_height:
        raise ValidationError(
            {
                'file': _('Ảnh quá nhỏ, tối thiểu %(width)s×%(height)s px.')
                % {'width': min_width, 'height': min_height}
            }
        )
    if ratio and not ratio[0] <= width / height <= ratio[1]:
        raise ValidationError(
            {'file': _('Ảnh banner trang chủ cần tỉ lệ khoảng 8:3, ví dụ 1600×600 px.')}
        )

    saved = save_image_upload(
        upload,
        BANNER_DIRECTORY,
        request=request,
        max_dimensions=(BANNER_MAX_SIDE, BANNER_MAX_SIDE),
    )
    return {
        'path': saved['path'],
        'url': saved['url'],
        'width': saved['width'],
        'height': saved['height'],
    }
