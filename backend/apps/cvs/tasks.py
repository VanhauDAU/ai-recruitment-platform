"""Celery tasks for immutable CV export artifacts."""

from __future__ import annotations

from hashlib import sha256
import logging

from celery import shared_task
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from .models import CvExport, UserCv
from .pdf_renderer import render_cv_version_pdf

logger = logging.getLogger(__name__)


def _storage_key(export: CvExport) -> str:
    # Attempt number prevents a retry from silently serving a stale partial
    # artifact; the key remains private and is never serialized to clients.
    return (
        f'cvs/exports/{export.cv.public_id}/{export.version.public_id}/'
        f'{export.public_id}/attempt-{export.attempts}.pdf'
    )


@shared_task
def render_cv_export_job(export_id: int) -> None:
    """Render a queued immutable version and atomically record its private artifact."""
    with transaction.atomic():
        export = (
            # ``version.template_version`` is nullable for legacy rows. Lock
            # the job row only; PostgreSQL rejects FOR UPDATE on that nullable
            # outer-join side.
            CvExport.objects.select_for_update(of=('self',))
            .select_related('cv', 'version__template_version')
            .filter(pk=export_id)
            .first()
        )
        if export is None or export.status != CvExport.Status.PENDING:
            return
        export.status = CvExport.Status.PROCESSING
        export.attempts += 1
        export.started_at = timezone.now()
        export.save(update_fields=['status', 'attempts', 'started_at', 'updated_at'])

    try:
        # The renderer receives only the frozen version relation. Drafts and
        # frontend DOM are intentionally absent from this worker path.
        pdf_bytes = render_cv_version_pdf(export.version)
        storage_key = _storage_key(export)
        saved_key = default_storage.save(storage_key, ContentFile(pdf_bytes))
        checksum = sha256(pdf_bytes).hexdigest()
    except Exception:  # noqa: BLE001 - preserve no renderer exception payload that could contain PII
        logger.warning('Immutable CV PDF export %s failed.', export_id)
        CvExport.objects.filter(pk=export_id, status=CvExport.Status.PROCESSING).update(
            status=CvExport.Status.FAILED,
            last_error='render_failed',
            failed_at=timezone.now(),
        )
        return

    now = timezone.now()
    with transaction.atomic():
        completed = CvExport.objects.select_for_update().filter(
            pk=export_id,
            status=CvExport.Status.PROCESSING,
        ).first()
        if completed is None:
            # A manual repair/retry changed state while the worker rendered.
            # Retain no public reference to this unclaimed storage object.
            if default_storage.exists(saved_key):
                default_storage.delete(saved_key)
            return
        completed.status = CvExport.Status.COMPLETED
        completed.storage_key = saved_key
        completed.file_size_bytes = len(pdf_bytes)
        completed.checksum_sha256 = checksum
        completed.last_error = ''
        completed.completed_at = now
        completed.failed_at = None
        completed.save(update_fields=[
            'status', 'storage_key', 'file_size_bytes', 'checksum_sha256',
            'last_error', 'completed_at', 'failed_at', 'updated_at',
        ])
        UserCv.objects.filter(pk=completed.cv_id).update(last_exported_at=now, updated_at=now)


@shared_task
def dispatch_pending_cv_export_jobs() -> None:
    """Recover jobs left pending when a web process could not reach the broker."""
    job_ids = list(
        CvExport.objects.filter(status=CvExport.Status.PENDING)
        .order_by('queued_at')
        .values_list('pk', flat=True)[:100]
    )
    for export_id in job_ids:
        try:
            render_cv_export_job.delay(export_id)
        except Exception:  # noqa: BLE001 - leave the durable row for the next sweep
            logger.warning('Unable to dispatch pending immutable CV PDF export %s.', export_id)
