"""Chép ảnh đại diện của provider social vào storage nội bộ.

Ảnh Google (``lh3.googleusercontent.com``) bị chặn khi trình duyệt gửi kèm
Referer của site, còn ảnh Facebook là URL ký có hạn. Vì vậy backend tải ảnh một
lần lúc đăng nhập rồi lưu như ảnh người dùng tự tải lên.
"""

import logging
import re
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import ValidationError

from common.storage.media import delete_local_media_url, media_storage_path, save_image_upload

from ..models import User
from .profile import AVATAR_MAX_DIMENSIONS

logger = logging.getLogger(__name__)

# Chỉ tải từ CDN ảnh của chính provider: URL đến từ userinfo nhưng server vẫn
# không gọi tới host tùy ý (SSRF).
_AVATAR_HOSTS = {
    'google': ('googleusercontent.com',),
    'facebook': ('fbcdn.net', 'fbsbx.com'),
    'linkedin': ('licdn.com',),
}
_GOOGLE_SIZE = re.compile(r'=s\d+(-c)?$')
_TIMEOUT_SECONDS = 5


def _allowed_url(provider, url):
    parsed = urlparse(url or '')
    host = (parsed.hostname or '').lower()
    return parsed.scheme == 'https' and any(
        host == domain or host.endswith(f'.{domain}') for domain in _AVATAR_HOSTS.get(provider, ())
    )


def _download(url):
    """Tải ảnh, dừng ngay khi vượt giới hạn dung lượng ảnh tải lên."""
    max_size = settings.IMAGE_UPLOAD_MAX_SIZE
    with requests.get(url, stream=True, timeout=_TIMEOUT_SECONDS, allow_redirects=False) as resp:
        resp.raise_for_status()
        data = b''
        for chunk in resp.iter_content(64 * 1024):
            data += chunk
            if len(data) > max_size:
                raise ValidationError({'file': 'Provider avatar is too large.'})
    return ContentFile(data, name='avatar')


def import_provider_avatar(user, provider, url):
    """Lưu ảnh provider làm avatar nếu tài khoản chưa có ảnh trong storage.

    Không ghi đè ảnh người dùng đã tự tải lên; URL ngoài lưu từ trước (dữ liệu
    cũ) được thay. Lỗi tải chỉ ghi log để không chặn đăng nhập.
    """
    current = user.avatar_url
    if (current and media_storage_path(current)) or not _allowed_url(provider, url):
        return user
    if provider == 'google':
        url = _GOOGLE_SIZE.sub('=s256-c', url)

    try:
        saved = save_image_upload(
            _download(url),
            f'users/avatars/{user.public_id}',
            max_dimensions=AVATAR_MAX_DIMENSIONS,
        )
    except (requests.RequestException, ValidationError, OSError, Image.DecompressionBombError):
        logger.warning('Không chép được avatar %s của user %s', provider, user.pk, exc_info=True)
        return user

    # Hai lượt đăng nhập song song: chỉ lượt đầu được ghi, lượt sau xóa file thừa.
    updated = User.objects.filter(pk=user.pk, avatar_url=current).update(
        avatar_url=saved['path'], updated_at=timezone.now()
    )
    if updated:
        user.avatar_url = saved['path']
    else:
        delete_local_media_url(saved['path'])
    return user
