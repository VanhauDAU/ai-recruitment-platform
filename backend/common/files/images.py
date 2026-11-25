"""Mở ảnh người dùng tải lên trong giới hạn và mã hóa lại trước khi lưu.

``open_bounded_image`` chỉ đọc header rồi kiểm kích thước, số frame trước khi
Pillow giải mã điểm ảnh, nên ảnh "bom giải nén" (tệp vài KB khai 50.000 px mỗi
cạnh) bị từ chối mà không tốn RAM. ``reencode_image`` dựng lại tệp từ điểm ảnh:
metadata (EXIF, GPS, XMP, chú thích) và dữ liệu ghép sau ảnh (polyglot) không
sang được tệp lưu.
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps, ImageSequence

MAX_IMAGE_SIDE = 10_000
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_FRAMES = 100
# Tổng điểm ảnh của mọi frame: khi mã hóa lại, mọi frame được giải mã (RGBA, 4 byte/điểm)
# và giữ trong RAM cùng lúc. 25M điểm ≈ 100 MB mỗi request — vừa với backend 1 GB / 8 luồng.
MAX_ANIMATION_PIXELS = 25_000_000
UPLOAD_IMAGE_FORMATS = ('JPEG', 'PNG', 'GIF', 'WEBP')

# Lưới an toàn cho mọi Image.open khác trong process: Pillow cảnh báo khi vượt
# mức này và từ chối (DecompressionBombError) khi vượt gấp đôi.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class UnsafeImage(ValueError):
    """Ảnh hỏng, sai định dạng hoặc vượt giới hạn kích thước/frame."""


@dataclass(frozen=True)
class EncodedImage:
    data: bytes
    format: str
    width: int
    height: int


def _frame_limit(pixels):
    return min(MAX_IMAGE_FRAMES, MAX_ANIMATION_PIXELS // pixels)


def _check_frames(image, limit):
    """Đếm frame tới ``limit`` + 1 rồi dừng, không duyệt hết tệp có hàng triệu frame."""
    if not getattr(image, 'is_animated', False):
        return
    frame = 1
    try:
        while True:
            image.seek(frame)
            frame += 1
            if frame > limit:
                raise UnsafeImage
    except EOFError:
        pass
    finally:
        image.seek(0)


def open_bounded_image(source, *, formats=UPLOAD_IMAGE_FORMATS):
    """Mở ``source`` (chưa giải mã) sau khi kiểm cạnh, số điểm ảnh và số frame.

    Người gọi đóng ảnh (dùng ``with``). Lỗi parser của Pillow quy về ``UnsafeImage``.
    """
    try:
        source.seek(0)
        image = Image.open(source, formats=formats)
    except Exception as error:  # noqa: BLE001 - lỗi parser không vượt ranh giới
        raise UnsafeImage from error
    try:
        width, height = image.size
        if (
            min(width, height) < 1
            or max(width, height) > MAX_IMAGE_SIDE
            or width * height > MAX_IMAGE_PIXELS
        ):
            raise UnsafeImage
        _check_frames(image, _frame_limit(width * height))
    except UnsafeImage:
        image.close()
        raise
    except Exception as error:  # noqa: BLE001 - lỗi parser không vượt ranh giới
        image.close()
        raise UnsafeImage from error
    return image


def _fit(frame, max_size):
    if max_size:
        frame.thumbnail(max_size, Image.Resampling.LANCZOS)
    return frame


def _encode_static(image, image_format, max_size, buffer):
    source_mode = image.mode
    frame = _fit(ImageOps.exif_transpose(image), max_size)
    icc_profile = image.info.get('icc_profile')
    transparency = frame.info.get('transparency')
    options = {}
    if image_format == 'JPEG':
        frame = frame.convert('RGB')
        options = {'quality': 88, 'optimize': True, 'progressive': True}
    elif image_format == 'WEBP':
        has_alpha = 'A' in frame.getbands() or transparency is not None
        frame = frame.convert('RGBA' if has_alpha else 'RGB')
        options = {'quality': 85}
    elif image_format == 'PNG':
        options = {'optimize': True}
    if transparency is not None and image_format in {'PNG', 'GIF'}:
        options['transparency'] = transparency
    # Hồ sơ màu chỉ đúng với hệ màu gốc (CMYK/xám chuyển sang RGB thì bỏ).
    if icc_profile and frame.mode == source_mode:
        options['icc_profile'] = icc_profile
    # Không để Pillow lấy EXIF/XMP từ ``info`` khi ghi.
    frame.info = {}
    frame.save(buffer, format=image_format, **options)
    return frame.size


def _encode_animation(image, image_format, max_size, buffer):
    frames = []
    durations = []
    for frame in ImageSequence.Iterator(image):
        # WebP chỉ điền ``duration`` sau khi frame được giải mã (convert gọi load).
        frames.append(_fit(frame.convert('RGBA'), max_size))
        durations.append(frame.info.get('duration', 100))
    options = {'quality': 85} if image_format == 'WEBP' else {'disposal': 2}
    first = frames[0]
    first.info = {}
    first.save(
        buffer,
        format=image_format,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=image.info.get('loop', 0),
        **options,
    )
    return first.size


def reencode_image(image, *, max_size=None):
    """Mã hóa lại ``image`` (từ ``open_bounded_image``) cùng định dạng, bỏ metadata.

    Ảnh tĩnh xoay theo EXIF Orientation rồi bỏ EXIF (gồm GPS), giữ hồ sơ màu ICC.
    GIF/WebP động giữ frame, thời lượng và số vòng lặp. ``max_size`` thu nhỏ
    giữ tỉ lệ.
    """
    image_format = image.format
    if image_format not in UPLOAD_IMAGE_FORMATS:
        raise UnsafeImage
    buffer = BytesIO()
    try:
        if getattr(image, 'is_animated', False) and image_format in {'GIF', 'WEBP'}:
            width, height = _encode_animation(image, image_format, max_size, buffer)
        else:
            width, height = _encode_static(image, image_format, max_size, buffer)
    except Exception as error:  # noqa: BLE001 - lỗi giải mã không vượt ranh giới
        raise UnsafeImage from error
    return EncodedImage(buffer.getvalue(), image_format, width, height)
