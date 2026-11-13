"""Idempotent catalogue snapshot generation from the canonical renderer path."""

import json
import logging
from hashlib import sha256
from time import monotonic
from types import SimpleNamespace
from urllib.parse import quote

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.core.files.base import ContentFile
from django.db import models, transaction
from django.utils import timezone

from apps.cvs.schemas import empty_content
from apps.cvs.services.composition import compose_cv_document
from apps.cvs.services.pdf_renderer import print_payload, render_document_pdf
from common.metrics import record_metric
from common.pdf_raster import first_pdf_page_image
from common.r2_storage import public_media_storage

from .demo_identity import with_demo_identity
from .models import CATALOG_LANGUAGES, CvSampleContent, CvTemplateColorLink, CvTemplateVersion
from .services.sample_generation import execute_sample_generation, fail_sample_generation
from .services.template_preview import fail_test_pdf, finish_test_pdf, preview_document

logger = logging.getLogger(__name__)
SNAPSHOT_RENDERER_VERSION = 'catalogue-snapshot-v2'  # v2: Chromium print page (CVT-2)

# Ảnh mẫu có ảnh đại diện minh họa (bóng người trung tính), không phải ảnh thật.
SNAPSHOT_AVATAR_ID = 'catalogue-avatar'
SNAPSHOT_AVATAR_URI = 'data:image/svg+xml,' + quote(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    '<rect width="120" height="120" fill="#e2e8f0"/>'
    '<circle cx="60" cy="46" r="22" fill="#94a3b8"/>'
    '<path d="M18 120c4-26 22-40 42-40s38 14 42 40z" fill="#94a3b8"/></svg>'
)


def _source_content(locale):
    sample = (
        CvSampleContent.objects.filter(
            locale=locale,
            status=CvSampleContent.Status.PUBLISHED,
            position_profile__isnull=False,
        )
        .order_by('-updated_at', '-pk')
        .first()
    )
    return (
        (sample.content_json, f'sample:{sample.public_id}:{sample.updated_at.isoformat()}')
        if sample
        else (
            empty_content(locale),
            'blank-v1',
        )
    )


def _snapshot_content(content, locale):
    content = with_demo_identity(content, locale)
    content['personal_info']['avatar_asset_id'] = SNAPSHOT_AVATAR_ID
    return content


def snapshot_fingerprint(link):
    template = link.template
    version = template.current_published_version
    # Ảnh thumbnail dùng ngôn ngữ đầu tiên mà template có tên (tiếng Việt trước),
    # để không render bằng một ngôn ngữ ngẫu nhiên.
    locale = next(
        (
            language.code
            for language in CATALOG_LANGUAGES
            if template.localized('display_name', language.code)
        ),
        CATALOG_LANGUAGES[0].code,
    )
    _, source_revision = _source_content(locale)
    payload = {
        'template_version': version.pk if version else None,
        'renderer_contract': f'{version.renderer_key}:{version.renderer_version}'
        if version
        else None,
        'snapshot_renderer': SNAPSHOT_RENDERER_VERSION,
        'color': link.color.hex_code,
        'source_revision': source_revision,
    }
    return sha256(json.dumps(payload, sort_keys=True).encode('utf-8')).hexdigest(), locale


def _first_page_png(pdf_bytes, *, width):
    return first_pdf_page_image(pdf_bytes, width=width, image_format='PNG')


def _save_once(key, payload):
    storage = public_media_storage()
    if storage.exists(key):
        return key
    return storage.save(key, ContentFile(payload))


@shared_task
def generate_template_color_snapshot(link_id):
    started_at = monotonic()
    link = (
        CvTemplateColorLink.objects.select_related(
            'template__current_published_version',
            'color',
        )
        .filter(pk=link_id)
        .first()
    )
    if link is None or link.template.current_published_version is None:
        return
    fingerprint, locale = snapshot_fingerprint(link)
    if link.snapshot_fingerprint == fingerprint and link.thumbnail_url and link.preview_url:
        return

    content, _ = _source_content(locale)
    document = compose_cv_document(
        template=link.template,
        template_version=link.template.current_published_version,
        content_json=_snapshot_content(content, locale),
        theme_color=link.color.hex_code,
    )
    frozen_version = SimpleNamespace(
        **document,
        template_version=link.template.current_published_version,
    )
    try:
        payload = print_payload(frozen_version)
        payload['assets'][SNAPSHOT_AVATAR_ID] = {'url': SNAPSHOT_AVATAR_URI}
        pdf_bytes = render_document_pdf(payload)
        preview_bytes = _first_page_png(pdf_bytes, width=1200)
        thumbnail_bytes = _first_page_png(pdf_bytes, width=600)
        base = f'cv-templates/snapshots/{link.template.public_id}/{fingerprint}'
        preview_key = _save_once(f'{base}-preview.png', preview_bytes)
        thumbnail_key = _save_once(f'{base}-thumbnail.png', thumbnail_bytes)
    except Exception:  # noqa: BLE001 - task never logs configured CV content
        logger.warning('Template colour snapshot %s failed.', link_id)
        record_metric('cv_snapshot_failure')
        record_metric(
            'cv_snapshot_duration_ms', round((monotonic() - started_at) * 1000, 2), status='failed'
        )
        return

    with transaction.atomic():
        current = CvTemplateColorLink.objects.select_for_update().get(pk=link_id)
        current_fingerprint, _ = snapshot_fingerprint(current)
        if current_fingerprint != fingerprint:
            return
        old_keys = [current.thumbnail_url, current.preview_url]
        current.thumbnail_url = thumbnail_key
        current.preview_url = preview_key
        current.snapshot_fingerprint = fingerprint
        current.snapshot_generated_at = timezone.now()
        current.save(
            update_fields=[
                'thumbnail_url',
                'preview_url',
                'snapshot_fingerprint',
                'snapshot_generated_at',
            ]
        )
        for old_key in set(filter(None, old_keys)):
            if (
                old_key != thumbnail_key
                and old_key != preview_key
                and 'cv-templates/snapshots/' in old_key
            ):
                transaction.on_commit(
                    lambda key=old_key: delete_stale_snapshot.apply_async(
                        (key,), countdown=STALE_SNAPSHOT_GRACE_SECONDS
                    )
                )
    record_metric(
        'cv_snapshot_duration_ms', round((monotonic() - started_at) * 1000, 2), status='completed'
    )


# Ảnh mẫu cũ chưa xóa ngay: trang ứng viên đang mở (hoặc bản cache) vẫn trỏ tới
# nó; xóa ngay làm ảnh vỡ cho tới khi tải lại danh sách.
STALE_SNAPSHOT_GRACE_SECONDS = 30 * 60


@shared_task
def delete_stale_snapshot(key):
    """Xóa ảnh mẫu đã bị thay, trừ khi nó lại được dùng (cấu hình quay về cũ)."""
    if 'cv-templates/snapshots/' not in key:
        return
    if CvTemplateColorLink.objects.filter(
        models.Q(thumbnail_url=key) | models.Q(preview_url=key)
    ).exists():
        return
    public_media_storage().delete(key)


def enqueue_template_snapshots(template):
    for link_id in template.color_links.values_list('pk', flat=True):
        transaction.on_commit(
            lambda link_id=link_id: generate_template_color_snapshot.delay(link_id)
        )


@shared_task
def regenerate_all_template_snapshots():
    for link_id in (
        CvTemplateColorLink.objects.filter(
            template__current_published_version__isnull=False,
            color__is_active=True,
        )
        .values_list('pk', flat=True)
        .iterator()
    ):
        generate_template_color_snapshot.delay(link_id)


@shared_task(
    name='apps.cv_templates.tasks.generate_cv_sample_content',
    soft_time_limit=85,
    time_limit=90,
)
def generate_cv_sample_content(generation_id):
    """Sinh một nội dung CV mẫu chờ duyệt (CVT-3); chạy trên hàng đợi `ai-generation`."""
    try:
        sample = execute_sample_generation(generation_id)
    except SoftTimeLimitExceeded:
        fail_sample_generation(generation_id, code='generation_timeout')
        return None
    return sample.public_id if sample else None


@shared_task(name='apps.cv_templates.tasks.render_template_test_pdf')
def render_template_test_pdf(token, version_id, options):
    """PDF thử của một phiên bản template (wizard admin, CVT-4); kết quả vào cache."""
    version = CvTemplateVersion.objects.select_related('template').filter(pk=version_id).first()
    if version is None:
        fail_test_pdf(token)
        return
    try:
        document = preview_document(version.template, version, **options)
        payload = print_payload(SimpleNamespace(**document, template_version=version))
        payload['assets'][SNAPSHOT_AVATAR_ID] = {'url': SNAPSHOT_AVATAR_URI}
        payload['document']['content_json']['personal_info']['avatar_asset_id'] = SNAPSHOT_AVATAR_ID
        finish_test_pdf(token, version, render_document_pdf(payload))
    except Exception:  # noqa: BLE001 - only a status reaches the admin, never content
        logger.warning('Template test PDF for version %s failed.', version_id)
        fail_test_pdf(token)
