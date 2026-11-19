"""Xem trước nội dung mẫu theo vị trí trên một template của kho mẫu công khai."""

import json
from copy import deepcopy
from hashlib import sha256

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

from apps.cv_templates.models.content_schema import empty_content

from .composition import CvCompositionError, compose_cv_document, finalize_preview_document
from .demo_identity import with_demo_identity

# Thời gian giữ document xem trước trong cache máy chủ (Redis).
PREVIEW_CACHE_SECONDS = 300


def _digest(value):
    return sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    ).hexdigest()


def blank_position_content(*, locale, experience_band):
    """Nội dung trống, cùng dạng với `resolve_position_content`."""
    return {
        'position_public_id': None,
        'name_vi': '',
        'locale': locale,
        'experience_band': experience_band,
        'source': 'blank',
        'sample_content_public_id': None,
        'schema_version': 1,
        'content_json': empty_content(locale),
    }


def compose_position_preview(
    *, template, resolved, locale, experience_band, theme_color, actor, demo_identity
):
    """Ghép `resolved` (nội dung theo vị trí) lên phiên bản đang xuất bản của `template`.

    Document gốc (chưa gắn danh tính và màu) được cache theo phiên bản, ngôn ngữ,
    vị trí, nhóm kinh nghiệm và nội dung. Trả `(data, cache_hit)`; `data['revision']`
    là băm của document cuối và renderer, dùng làm ETag.
    """
    version = template.current_published_version
    cache_key = ':'.join(
        [
            'cv-position-preview',
            str(version.pk if version else 'missing'),
            locale,
            resolved['position_public_id'] or 'blank',
            experience_band,
            _digest(resolved['content_json']),
        ]
    )
    base_document = cache.get(cache_key)
    cache_hit = base_document is not None
    if base_document is None:
        try:
            base_document = compose_cv_document(
                template=template,
                content_json=resolved['content_json'],
            )
        except (CvCompositionError, DjangoValidationError) as error:
            raise ValidationError({'template_public_id': str(error)}) from error
        cache.set(cache_key, base_document, timeout=PREVIEW_CACHE_SECONDS)

    preview = deepcopy(base_document)
    if demo_identity:
        preview['content_json'] = with_demo_identity(preview['content_json'], locale)
    document = finalize_preview_document(preview, actor=actor, theme_color=theme_color or None)
    data = {
        **resolved,
        'document': document,
        'renderer': {
            'key': version.renderer_key,
            'version': version.renderer_version,
            'schema_version': version.schema_version,
            'capabilities': version.capabilities,
        },
        'revision': _digest(
            {
                'document': document,
                'renderer_key': version.renderer_key,
                'renderer_version': version.renderer_version,
            }
        ),
    }
    return data, cache_hit
