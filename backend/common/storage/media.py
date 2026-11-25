from pathlib import PurePosixPath
from urllib.parse import unquote, urljoin, urlparse
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from rest_framework.exceptions import ValidationError

from common.files.images import UnsafeImage, open_bounded_image, reencode_image
from common.files.signatures import image_content_type
from common.storage.r2 import public_media_storage

_IMAGE_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
}
_PILLOW_FORMATS = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
}


def validate_image_upload(upload):
    max_size = settings.IMAGE_UPLOAD_MAX_SIZE
    if upload.size > max_size:
        max_mb = max_size / 1024 / 1024
        raise ValidationError({'file': f'Image must be smaller than {max_mb:g} MB.'})

    header = upload.read(32)
    upload.seek(0)

    content_type = image_content_type(header)
    if not content_type:
        raise ValidationError({'file': 'Only JPG, PNG, GIF, or WebP images are supported.'})
    return _IMAGE_EXTENSIONS[content_type], content_type


def save_image_upload(upload, directory, request=None, max_dimensions=None):
    """Kiểm, mã hóa lại (bỏ EXIF/GPS, thu nhỏ nếu cần) rồi lưu ảnh vào public media.

    Tệp lưu luôn được dựng lại từ điểm ảnh, không bao giờ là byte gốc người dùng gửi.
    """
    extension, content_type = validate_image_upload(upload)
    try:
        with open_bounded_image(upload) as image:
            if image.format != _PILLOW_FORMATS[content_type]:
                raise UnsafeImage
            encoded = reencode_image(image, max_size=max_dimensions)
    except UnsafeImage as error:
        raise ValidationError({'file': 'The image is corrupted or too large.'}) from error

    safe_directory = str(PurePosixPath(directory.strip('/')))
    path = public_media_storage().save(
        f'{safe_directory}/{uuid4().hex}.{extension}', ContentFile(encoded.data)
    )

    return {
        'path': path,
        'url': media_public_url(path, request=request),
        'content_type': content_type,
        'size': len(encoded.data),
        'name': upload.name,
        'width': encoded.width,
        'height': encoded.height,
    }


def media_public_url(path, request=None):
    url = public_media_storage().url(path)
    public_base_url = settings.MEDIA_PUBLIC_BASE_URL

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
    public_base_url = settings.MEDIA_PUBLIC_BASE_URL
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
