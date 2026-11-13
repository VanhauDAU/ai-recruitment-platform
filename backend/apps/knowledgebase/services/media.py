from django.core.exceptions import ValidationError

from common.media_storage import delete_local_media_url, save_image_upload

from ..models import KnowledgeMediaAsset

ALLOWED_KNOWLEDGE_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_KNOWLEDGE_IMAGE_BYTES = 5 * 1024 * 1024


class KnowledgeMediaTooLarge(Exception):
    pass


def upload_knowledge_media(*, upload, actor, default_alt_text='', request=None):
    if upload.size > MAX_KNOWLEDGE_IMAGE_BYTES:
        raise KnowledgeMediaTooLarge('Ảnh knowledgebase không được vượt quá 5 MB.')

    saved = save_image_upload(
        upload,
        'knowledgebase/content',
        request=request,
        max_dimensions=(1600, 1600),
    )
    if saved['content_type'] not in ALLOWED_KNOWLEDGE_IMAGE_TYPES:
        delete_local_media_url(saved['path'])
        raise ValidationError({'file': 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.'})

    try:
        return KnowledgeMediaAsset.objects.create(
            storage_key=saved['path'],
            original_name=saved['name'][:255],
            content_type=saved['content_type'],
            size_bytes=saved['size'],
            width=saved['width'],
            height=saved['height'],
            default_alt_text=str(default_alt_text or '').strip()[:300],
            uploaded_by=actor,
        )
    except Exception:
        delete_local_media_url(saved['path'])
        raise
