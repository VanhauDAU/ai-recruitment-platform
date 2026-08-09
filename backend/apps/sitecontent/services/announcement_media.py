"""Upload ảnh nền strip thông báo (AN-V2)."""

from django.core.exceptions import ValidationError
from PIL import Image
from rest_framework.exceptions import ValidationError as DrfValidationError

from common.media_storage import save_image_upload, validate_image_upload

ANNOUNCEMENT_BG_MAX_BYTES = 1 * 1024 * 1024
ANNOUNCEMENT_BG_MIN_WIDTH = 640
ANNOUNCEMENT_BG_MIN_HEIGHT = 24
ANNOUNCEMENT_BG_MAX_WIDTH = 2400
ANNOUNCEMENT_BG_MAX_HEIGHT = 120
ANNOUNCEMENT_BG_DIRECTORY = 'site/announcements/backgrounds'


def upload_announcement_background(*, upload, request=None):
    """Validate strip banner (ngang hẹp) rồi lưu public media.

    Khuyến nghị 980×31; cho phép 640–2400 × 24–120, ≤ 1 MB.
    """
    if upload is None:
        raise DrfValidationError({'file': 'Chọn file ảnh nền.'})
    if getattr(upload, 'size', 0) > ANNOUNCEMENT_BG_MAX_BYTES:
        raise DrfValidationError({'file': 'Ảnh nền tối đa 1 MB.'})

    try:
        validate_image_upload(upload)
    except DrfValidationError:
        raise
    except ValidationError as error:
        raise DrfValidationError(getattr(error, 'message_dict', {'file': str(error)})) from error

    upload.seek(0)
    try:
        with Image.open(upload) as image:
            width, height = image.size
    except OSError as error:
        raise DrfValidationError({'file': 'Không đọc được file ảnh.'}) from error
    finally:
        upload.seek(0)

    if width < ANNOUNCEMENT_BG_MIN_WIDTH or height < ANNOUNCEMENT_BG_MIN_HEIGHT:
        raise DrfValidationError(
            {
                'file': (
                    f'Ảnh quá nhỏ. Tối thiểu '
                    f'{ANNOUNCEMENT_BG_MIN_WIDTH}×{ANNOUNCEMENT_BG_MIN_HEIGHT} px '
                    f'(khuyến nghị ~980×31).'
                )
            }
        )
    if height > ANNOUNCEMENT_BG_MAX_HEIGHT:
        raise DrfValidationError(
            {
                'file': (
                    f'Chiều cao tối đa {ANNOUNCEMENT_BG_MAX_HEIGHT} px (dải thông báo ngang hẹp).'
                )
            }
        )
    if width > ANNOUNCEMENT_BG_MAX_WIDTH:
        raise DrfValidationError({'file': f'Chiều rộng tối đa {ANNOUNCEMENT_BG_MAX_WIDTH} px.'})

    # GIF animation không phù hợp strip; chặn sau khi biết format.
    upload.seek(0)
    header = upload.read(6)
    upload.seek(0)
    if header.startswith(b'GIF'):
        raise DrfValidationError({'file': 'Chỉ nhận JPEG, PNG hoặc WebP (không GIF).'})

    saved = save_image_upload(
        upload,
        ANNOUNCEMENT_BG_DIRECTORY,
        request=request,
        max_dimensions=(ANNOUNCEMENT_BG_MAX_WIDTH, ANNOUNCEMENT_BG_MAX_HEIGHT),
    )
    return {
        'path': saved['path'],
        'url': saved['url'],
        'width': saved['width'],
        'height': saved['height'],
        'content_type': saved['content_type'],
        'size': saved['size'],
    }
