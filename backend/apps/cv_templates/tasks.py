"""Idempotent catalogue snapshot generation from the canonical renderer path."""

from io import BytesIO
from hashlib import sha256
import json
import logging
from time import monotonic
from types import SimpleNamespace

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from common.metrics import record_metric

from apps.cvs.composition import compose_cv_document
from apps.cvs.pdf_renderer import render_cv_version_pdf
from apps.cvs.schemas import empty_content

from .models import CvSampleContent, CvTemplateColorLink

logger = logging.getLogger(__name__)
SNAPSHOT_RENDERER_VERSION = 'catalogue-snapshot-v1'


def _source_content(locale):
    sample = (
        CvSampleContent.objects.filter(locale=locale, status=CvSampleContent.Status.PUBLISHED)
        .order_by('-updated_at', '-pk')
        .first()
    )
    return (sample.content_json, f'sample:{sample.public_id}:{sample.updated_at.isoformat()}') if sample else (
        empty_content(locale), 'blank-v1',
    )


def snapshot_fingerprint(link):
    template = link.template
    version = template.current_published_version
    localization = template.localizations.filter(is_active=True).order_by('locale').first()
    locale = localization.locale if localization else 'vi-VN'
    _, source_revision = _source_content(locale)
    payload = {
        'template_version': version.pk if version else None,
        'renderer_contract': f'{version.renderer_key}:{version.renderer_version}' if version else None,
        'snapshot_renderer': SNAPSHOT_RENDERER_VERSION,
        'color': link.color.hex_code,
        'source_revision': source_revision,
    }
    return sha256(json.dumps(payload, sort_keys=True).encode('utf-8')).hexdigest(), locale


def _first_page_png(pdf_bytes, *, width):
    try:
        import pypdfium2 as pdfium
    except ImportError as error:  # pragma: no cover - deployment dependency check
        raise RuntimeError('pypdfium2 is unavailable') from error
    document = pdfium.PdfDocument(pdf_bytes)
    try:
        page = document[0]
        try:
            page_width, _ = page.get_size()
            bitmap = page.render(scale=width / page_width)
            try:
                image = bitmap.to_pil().convert('RGB')
            finally:
                bitmap.close()
        finally:
            page.close()
    finally:
        document.close()
    output = BytesIO()
    image.save(output, format='PNG', optimize=True)
    return output.getvalue()


def _save_once(key, payload):
    if default_storage.exists(key):
        return key
    return default_storage.save(key, ContentFile(payload))


@shared_task
def generate_template_color_snapshot(link_id):
    started_at = monotonic()
    link = (
        CvTemplateColorLink.objects.select_related(
            'template__current_published_version', 'color',
        ).filter(pk=link_id).first()
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
        content_json=content,
        theme_color=link.color.hex_code,
    )
    frozen_version = SimpleNamespace(
        **document,
        template_version=link.template.current_published_version,
    )
    try:
        pdf_bytes = render_cv_version_pdf(frozen_version)
        preview_bytes = _first_page_png(pdf_bytes, width=1200)
        thumbnail_bytes = _first_page_png(pdf_bytes, width=600)
        base = f'cv-templates/snapshots/{link.template.public_id}/{fingerprint}'
        preview_key = _save_once(f'{base}-preview.png', preview_bytes)
        thumbnail_key = _save_once(f'{base}-thumbnail.png', thumbnail_bytes)
    except Exception:  # noqa: BLE001 - task never logs configured CV content
        logger.warning('Template colour snapshot %s failed.', link_id)
        record_metric('cv_snapshot_failure')
        record_metric('cv_snapshot_duration_ms', round((monotonic() - started_at) * 1000, 2), status='failed')
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
        current.save(update_fields=[
            'thumbnail_url', 'preview_url', 'snapshot_fingerprint', 'snapshot_generated_at',
        ])
        for old_key in set(filter(None, old_keys)):
            if old_key != thumbnail_key and old_key != preview_key and 'cv-templates/snapshots/' in old_key:
                transaction.on_commit(lambda key=old_key: default_storage.delete(key))
    record_metric('cv_snapshot_duration_ms', round((monotonic() - started_at) * 1000, 2), status='completed')


def enqueue_template_snapshots(template):
    for link_id in template.color_links.values_list('pk', flat=True):
        transaction.on_commit(lambda link_id=link_id: generate_template_color_snapshot.delay(link_id))


@shared_task
def regenerate_all_template_snapshots():
    for link_id in CvTemplateColorLink.objects.filter(
        template__current_published_version__isnull=False,
        color__is_active=True,
    ).values_list('pk', flat=True).iterator():
        generate_template_color_snapshot.delay(link_id)
