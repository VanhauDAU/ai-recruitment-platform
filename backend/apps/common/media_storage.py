from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urljoin, urlparse
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image
from rest_framework.exceptions import ValidationError


ALLOWED_IMAGE_SIGNATURES = {
    'jpg': (b'\xff\xd8\xff', 'image/jpeg'),
    'png': (b'\x89PNG\r\n\x1a\n', 'image/png'),
    'gif': (b'GIF87a', 'image/gif'),
    'webp': (b'RIFF', 'image/webp'),
}

WEBP_CONTAINER_MARKER = b'WEBP'


def validate_image_upload(upload):
    max_size = getattr(settings, 'IMAGE_UPLOAD_MAX_SIZE', 5 * 1024 * 1024)
    if upload.size > max_size:
        max_mb = max_size / 1024 / 1024
        raise ValidationError({'file': f'Image must be smaller than {max_mb:g} MB.'})

    header = upload.read(32)
    upload.seek(0)

    for extension, (signature, content_type) in ALLOWED_IMAGE_SIGNATURES.items():
        if extension == 'webp':
            if header.startswith(signature) and WEBP_CONTAINER_MARKER in header[8:16]:
                return extension, content_type
            continue
        if header.startswith(signature):
            return extension, content_type

    raise ValidationError({'file': 'Only JPG, PNG, GIF, or WebP images are supported.'})


def _downscale_if_needed(upload, extension, max_dimensions):
    """Resize ảnh raster nếu vượt max_dimensions (giữ tỉ lệ). GIF (animation) bỏ qua.

    Trả None nếu không cần resize (ảnh đã đủ nhỏ), để dùng lại file upload gốc.
    """
    if extension == 'gif':
        return None

    max_w, max_h = max_dimensions
    upload.seek(0)
    image = Image.open(upload)
    if image.width <= max_w and image.height <= max_h:
        upload.seek(0)
        return None

    image.load()
    image.thumbnail((max_w, max_h), Image.LANCZOS)
    save_format = 'PNG' if extension == 'png' else image.format
    if save_format == 'JPEG' and image.mode in ('RGBA', 'P'):
        image = image.convert('RGB')

    buffer = BytesIO()
    image.save(buffer, format=save_format, optimize=True)
    buffer.seek(0)
    return ContentFile(buffer.read())


def save_image_upload(upload, directory, request=None, max_dimensions=None):
    extension, content_type = validate_image_upload(upload)
    safe_directory = str(PurePosixPath(directory.strip('/')))
    filename = f'{uuid4().hex}.{extension}'

    file_to_save = upload
    if max_dimensions:
        resized = _downscale_if_needed(upload, extension, max_dimensions)
        if resized is not None:
            file_to_save = resized

    path = default_storage.save(f'{safe_directory}/{filename}', file_to_save)

    return {
        'path': path,
        'url': media_public_url(path, request=request),
        'content_type': content_type,
        'size': file_to_save.size,
        'name': upload.name,
    }


def media_public_url(path, request=None):
    url = default_storage.url(path)
    public_base_url = getattr(settings, 'MEDIA_PUBLIC_BASE_URL', '').strip()

    if public_base_url and url.startswith('/'):
        return urljoin(f'{public_base_url.rstrip("/")}/', url.lstrip('/'))
    if request and url.startswith('/'):
        return request.build_absolute_uri(url)
    return url


def delete_local_media_url(url):
    if not url:
        return

    parsed = urlparse(url)
    path = parsed.path if parsed.scheme else url
    media_url = settings.MEDIA_URL

    if not path.startswith(media_url):
        return

    storage_path = path[len(media_url):].lstrip('/')
    if storage_path and default_storage.exists(storage_path):
        default_storage.delete(storage_path)
