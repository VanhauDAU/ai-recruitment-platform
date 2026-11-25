from django.conf import settings
from django.core.files.base import ContentFile
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from common.http.safe_fetch import RemoteFetchError, RemoteFileTooLarge, fetch_public_file
from common.storage.media import save_image_upload

from ..models import BlogMediaAsset


def upload_blog_media(*, upload, actor, request=None):
    saved = save_image_upload(
        upload,
        'blog/content',
        request=request,
        max_dimensions=(1600, 1600),
    )
    return BlogMediaAsset.objects.create(
        storage_key=saved['path'],
        original_name=saved['name'][:255],
        content_type=saved['content_type'],
        size=saved['size'],
        uploaded_by=actor,
    )


def upload_blog_thumbnail(upload, *, request=None):
    """Store a post thumbnail; the post keeps the storage key, not the URL."""
    return save_image_upload(upload, 'blog/thumbnails', request=request, max_dimensions=(1600, 900))


def import_blog_thumbnail(url, *, request=None):
    """Download a linked image and store it exactly like an uploaded thumbnail."""
    try:
        data = fetch_public_file(url, max_size=settings.IMAGE_UPLOAD_MAX_SIZE)
    except RemoteFileTooLarge as error:
        raise ValidationError({'url': _('Ảnh ở đường dẫn này quá lớn.')}) from error
    except RemoteFetchError as error:
        raise ValidationError({'url': _('Không tải được ảnh từ đường dẫn này.')}) from error
    try:
        return upload_blog_thumbnail(ContentFile(data, name='thumbnail'), request=request)
    except ValidationError as error:
        raise ValidationError(
            {'url': _('Đường dẫn không phải ảnh JPG, PNG, GIF hoặc WebP hợp lệ.')}
        ) from error
