from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import unquote, urljoin, urlparse
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image
from rest_framework.exceptions import ValidationError

from common.r2_storage import public_media_storage


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

    path = public_media_storage().save(f'{safe_directory}/{filename}', file_to_save)

    return {
        'path': path,
        'url': media_public_url(path, request=request),
        'content_type': content_type,
        'size': file_to_save.size,
        'name': upload.name,
    }


def media_public_url(path, request=None):
    url = public_media_storage().url(path)
    public_base_url = getattr(settings, 'MEDIA_PUBLIC_BASE_URL', '').strip()

    if public_base_url and url.startswith('/'):
        return urljoin(f'{public_base_url.rstrip("/")}/', url.lstrip('/'))
    if request and url.startswith('/'):
        return request.build_absolute_uri(url)
    return url


def _normalise_storage_path(path):
    """Trả về storage key hợp lệ, không cho phép path traversal."""
    if not isinstance(path, str) or not path or path.startswith('/') or '\\' in path:
        return None

    normalised = PurePosixPath(path)
    if normalised.is_absolute() or '..' in normalised.parts or str(normalised) in {'.', ''}:
        return None
    return normalised.as_posix()


def _recognised_media_hosts():
    """Các host được phép coi là URL của storage nội bộ.

    Không tự nhận mọi URL có ``/media/`` là file nội bộ: một ảnh bên thứ ba có
    đường dẫn tương tự không được phép dẫn đến việc xoá nhầm file local.
    """
    hosts = {'localhost', '127.0.0.1', 'testserver'}
    public_base_url = getattr(settings, 'MEDIA_PUBLIC_BASE_URL', '').strip()
    if public_base_url:
        host = urlparse(public_base_url).hostname
        if host:
            hosts.add(host.lower())
    return hosts


def media_storage_path(value):
    """Lấy storage key từ giá trị media nội bộ, nếu có.

    Giá trị chuẩn trong database là key như ``site/settings/logo.png``. Hàm
    vẫn đọc được dữ liệu cũ ``/media/...`` và ``http://localhost:8000/media/...``
    để việc nâng cấp không làm mất ảnh đang dùng.
    """
    if not isinstance(value, str) or not value.strip():
        return None

    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme or parsed.netloc:
        if parsed.hostname not in _recognised_media_hosts():
            return None
        path = unquote(parsed.path)
    else:
        path = unquote(value.split('?', 1)[0].split('#', 1)[0])

    media_url = settings.MEDIA_URL
    if path.startswith(media_url):
        return _normalise_storage_path(path[len(media_url) :].lstrip('/'))

    # Chỉ URL relative mới có thể là storage key trực tiếp. URL đầy đủ bên thứ
    # ba được giữ nguyên kể cả khi phần path của nó trông giống storage key.
    if not (parsed.scheme or parsed.netloc):
        return _normalise_storage_path(path)
    return None


def normalise_media_value(value):
    """Chuẩn hoá media nội bộ về storage key; giữ nguyên URL ngoài hệ thống."""
    return media_storage_path(value) or value


def media_url_from_value(value, request=None):
    """Resolve storage key thành URL public tại thời điểm trả API."""
    storage_path = media_storage_path(value)
    return media_public_url(storage_path, request=request) if storage_path else value


def delete_local_media_url(value):
    """Xoá file nội bộ được tham chiếu bởi storage key hoặc URL legacy."""
    storage_path = media_storage_path(value)
    storage = public_media_storage()
    if storage_path and storage.exists(storage_path):
        storage.delete(storage_path)
