from hashlib import sha256
from html.parser import HTMLParser

from django.conf import settings
from django.core.exceptions import ValidationError

from common.content_html import content_html_plain_text, sanitize_content_html
from common.media_storage import media_storage_path

from ..models import KnowledgeMediaAsset


class _KnowledgeImageCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'img':
            self.images.append(dict(attrs))


def _canonicalize_media_url(tag, attribute, value):
    if tag != 'img' or attribute != 'src':
        return value
    storage_key = media_storage_path(value)
    if not storage_key:
        return value
    return f'{settings.MEDIA_URL.rstrip("/")}/{storage_key}'


def _validate_images(body):
    parser = _KnowledgeImageCollector()
    parser.feed(body)
    parser.close()
    storage_keys = []
    errors = []
    for image in parser.images:
        storage_key = media_storage_path(image.get('src'))
        if not storage_key:
            errors.append('Ảnh phải được tải lên kho media của ProCV trước khi chèn.')
            continue
        storage_keys.append(storage_key)
        decorative = image.get('data-decorative') == 'true'
        if not decorative and not str(image.get('alt') or '').strip():
            errors.append('Mỗi ảnh nội dung phải có alt text có nghĩa.')

    available = set(
        KnowledgeMediaAsset.objects.filter(storage_key__in=storage_keys).values_list(
            'storage_key', flat=True
        )
    )
    missing = sorted(set(storage_keys) - available)
    if missing:
        errors.append('Ảnh không thuộc kho media knowledgebase hoặc không còn tồn tại.')
    if errors:
        raise ValidationError({'body': errors})


def normalize_revision_content(*, title, body, source_reference):
    title = ' '.join(str(title or '').split())
    source_reference = str(source_reference or '').strip()
    if not title:
        raise ValidationError({'title': 'Nhập tiêu đề hoặc câu hỏi.'})
    if not source_reference:
        raise ValidationError(
            {'source_reference': 'Cần ghi route, đặc tả, test hoặc owner đã kiểm chứng.'}
        )

    sanitized_body = sanitize_content_html(
        body,
        url_normalizer=_canonicalize_media_url,
    )
    plain_text = content_html_plain_text(sanitized_body)
    if not plain_text:
        raise ValidationError({'body': 'Nội dung không được để trống.'})
    _validate_images(sanitized_body)
    digest = sha256(f'{title}\n{sanitized_body}'.encode()).hexdigest()
    return {
        'title': title,
        'body': sanitized_body,
        'body_plain_text': plain_text,
        'content_hash': digest,
        'source_reference': source_reference,
    }
