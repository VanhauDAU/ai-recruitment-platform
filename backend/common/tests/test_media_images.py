import struct
import zlib
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image, ImageCms
from rest_framework.exceptions import ValidationError

from common.files.images import (
    MAX_IMAGE_FRAMES,
    UnsafeImage,
    open_bounded_image,
)
from common.storage.media import save_image_upload
from common.storage.r2 import public_media_storage

GPS_IFD = 0x8825
ORIENTATION = 0x0112
MAKE = 0x010F


def _png_header(width, height):
    """PNG with a real IHDR claiming ``width``×``height`` and almost no pixel data."""

    def chunk(kind, data):
        return (
            struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
        )

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 0, 0, 0, 0)
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', zlib.compress(b'\x00'))
        + chunk(b'IEND', b'')
    )


def _encode(image, image_format, **options):
    buffer = BytesIO()
    image.save(buffer, format=image_format, **options)
    return buffer.getvalue()


def _exif_with_gps(orientation=1):
    exif = Image.Exif()
    exif[MAKE] = 'PhoneMaker'
    exif[ORIENTATION] = orientation
    exif.get_ifd(GPS_IFD)[2] = (21.0, 1.0, 30.0)  # GPSLatitude
    return exif


def _animated(image_format, frames=3, size=(8, 8)):
    images = [
        Image.new('RGB', size, (index * 80 % 256, index * 37 % 256, index * 11 % 256))
        for index in range(frames)
    ]
    return _encode(
        images[0],
        image_format,
        save_all=True,
        append_images=images[1:],
        duration=[120] * frames,
        loop=2,
    )


def _upload(payload, name='photo'):
    return SimpleUploadedFile(name, payload, content_type='application/octet-stream')


def _stored(saved):
    with public_media_storage().open(saved['path'], 'rb') as stored:
        return stored.read()


class OpenBoundedImageTests(SimpleTestCase):
    def test_normal_image_opens(self):
        with open_bounded_image(BytesIO(_png_header(32, 16))) as image:
            self.assertEqual(image.size, (32, 16))

    def test_side_or_pixel_count_over_the_limit_is_rejected_before_decoding(self):
        for width, height in ((10_001, 1), (1, 10_001), (8_000, 6_000)):
            with self.subTest(size=(width, height)), self.assertRaises(UnsafeImage):
                open_bounded_image(BytesIO(_png_header(width, height)))

    def test_too_many_frames_are_rejected(self):
        with self.assertRaises(UnsafeImage):
            open_bounded_image(BytesIO(_animated('GIF', frames=MAX_IMAGE_FRAMES + 1, size=(2, 2))))

    @patch('common.files.images.MAX_ANIMATION_PIXELS', 400)
    def test_total_animation_pixels_over_the_limit_are_rejected(self):
        with self.assertRaises(UnsafeImage):
            open_bounded_image(BytesIO(_animated('GIF', frames=30, size=(4, 4))))

    def test_garbage_and_unsupported_formats_are_rejected(self):
        bmp = _encode(Image.new('RGB', (4, 4)), 'BMP')
        for payload in (b'not an image', bmp):
            with self.subTest(payload=payload[:4]), self.assertRaises(UnsafeImage):
                open_bounded_image(BytesIO(payload))


class SaveImageUploadTests(SimpleTestCase):
    def test_jpeg_is_rotated_by_exif_then_stored_without_exif_or_gps(self):
        source = Image.new('RGB', (40, 20), 'blue')
        payload = _encode(source, 'JPEG', exif=_exif_with_gps(orientation=6))

        saved = save_image_upload(_upload(payload), 'tests/images')

        self.assertEqual((saved['width'], saved['height']), (20, 40))
        with Image.open(BytesIO(_stored(saved))) as stored:
            self.assertEqual(stored.format, 'JPEG')
            self.assertEqual(stored.mode, 'RGB')
            self.assertEqual(stored.size, (20, 40))
            self.assertEqual(dict(stored.getexif()), {})
            self.assertNotIn('exif', stored.info)
        self.assertNotIn(b'PhoneMaker', _stored(saved))

    def test_png_and_webp_exif_is_dropped(self):
        for image_format in ('PNG', 'WEBP'):
            with self.subTest(image_format=image_format):
                payload = _encode(Image.new('RGB', (8, 8)), image_format, exif=_exif_with_gps())

                stored = _stored(save_image_upload(_upload(payload), 'tests/images'))

                self.assertNotIn(b'PhoneMaker', stored)
                with Image.open(BytesIO(stored)) as image:
                    self.assertEqual(image.format, image_format)
                    self.assertEqual(dict(image.getexif()), {})

    def test_icc_profile_is_kept(self):
        icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        payload = _encode(Image.new('RGB', (8, 8)), 'JPEG', icc_profile=icc)

        stored = _stored(save_image_upload(_upload(payload), 'tests/images'))

        with Image.open(BytesIO(stored)) as image:
            self.assertEqual(image.info.get('icc_profile'), icc)

    def test_bytes_appended_after_the_image_are_not_stored(self):
        payload = _encode(Image.new('RGBA', (8, 8), (0, 0, 0, 0)), 'PNG')
        polyglot = payload + b'<script>alert(1)</script>'

        saved = save_image_upload(_upload(polyglot), 'tests/images')

        self.assertNotIn(b'<script>', _stored(saved))
        self.assertEqual(saved['size'], len(_stored(saved)))

    def test_animated_gif_and_webp_keep_frames_duration_and_loop(self):
        for image_format in ('GIF', 'WEBP'):
            with self.subTest(image_format=image_format):
                stored = _stored(
                    save_image_upload(_upload(_animated(image_format)), 'tests/images')
                )

                with Image.open(BytesIO(stored)) as image:
                    self.assertEqual(image.format, image_format)
                    self.assertEqual(image.n_frames, 3)
                    image.load()
                    self.assertEqual(image.info.get('loop'), 2)
                    self.assertEqual(image.info.get('duration'), 120)

    def test_max_dimensions_downscales_static_and_animated_images(self):
        static = _encode(Image.new('RGB', (400, 200)), 'PNG')
        animated = _animated('GIF', size=(400, 200))
        for payload in (static, animated):
            saved = save_image_upload(_upload(payload), 'tests/images', max_dimensions=(100, 100))

            self.assertEqual((saved['width'], saved['height']), (100, 50))

    def test_corrupt_or_oversized_images_raise_a_validation_error(self):
        truncated = _encode(Image.new('RGB', (64, 64), 'red'), 'PNG')[:60]
        for payload in (truncated, _png_header(20_000, 20_000)):
            with self.subTest(size=len(payload)), self.assertRaises(ValidationError):
                save_image_upload(_upload(payload), 'tests/images')

    def test_signature_and_decoded_format_must_agree(self):
        # Header PNG nhưng thân là JPEG: không được lưu dưới đuôi .png.
        jpeg = _encode(Image.new('RGB', (8, 8)), 'JPEG')
        with self.assertRaises(ValidationError):
            save_image_upload(_upload(_png_header(8, 8)[:8] + jpeg), 'tests/images')
