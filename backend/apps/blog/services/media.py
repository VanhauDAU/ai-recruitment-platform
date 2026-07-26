from common.media_storage import save_image_upload

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
