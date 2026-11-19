"""Celery tasks xử lý job nhập CV (trích văn bản → AI cấu trúc hóa)."""

from __future__ import annotations

import logging

from celery import shared_task
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from apps.ai_core.services import AiCvParseError, structure_cv_text
from apps.cv_templates.services import compose_cv_document, overlay_actor_identity
from apps.cvs.models import CvDraft, CvImportJob, UserCv
from apps.cvs.services.cv_document import CvDocumentRejected, read_cv_document
from apps.cvs.services.versions import create_version
from common.metrics import record_metric

logger = logging.getLogger(__name__)


class ImportProcessingError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _extract_import_text(cv):
    try:
        with default_storage.open(cv.file_url, 'rb') as source:
            return read_cv_document(source, cv.file_type)
    except CvDocumentRejected as error:
        raise ImportProcessingError(error.code) from error
    except OSError as error:
        raise ImportProcessingError('text_extraction_failed') from error


def _fail_import(job_id, code):
    now = timezone.now()
    with transaction.atomic():
        job = CvImportJob.objects.select_for_update().select_related('cv').filter(pk=job_id).first()
        if job is None or job.status != CvImportJob.Status.PROCESSING:
            return
        job.status = CvImportJob.Status.FAILED
        job.failure_code = code
        job.failed_at = now
        job.save(update_fields=['status', 'failure_code', 'failed_at', 'updated_at'])
        UserCv.objects.filter(pk=job.cv_id).update(
            processing_status=UserCv.ProcessingStatus.FAILED,
            error_message=code,
            updated_at=now,
        )
        duration_ms = (now - job.started_at).total_seconds() * 1000 if job.started_at else 0
        record_metric('cv_import_failure', failure_code=code)
        record_metric('cv_import_duration_ms', round(duration_ms, 2), status='failed')


@shared_task(soft_time_limit=50, time_limit=60)
def process_cv_import_job(job_id):
    with transaction.atomic():
        job = (
            CvImportJob.objects.select_for_update(of=('self',))
            .select_related(
                'cv__template__current_published_version',
                'user',
            )
            .filter(pk=job_id)
            .first()
        )
        if job is None or job.status != CvImportJob.Status.QUEUED:
            return
        job.status = CvImportJob.Status.PROCESSING
        job.attempts += 1
        job.started_at = timezone.now()
        job.save(update_fields=['status', 'attempts', 'started_at', 'updated_at'])
        UserCv.objects.filter(pk=job.cv_id).update(
            processing_status=UserCv.ProcessingStatus.PROCESSING,
            updated_at=timezone.now(),
        )

    try:
        text_value = _extract_import_text(job.cv)
        content = structure_cv_text(text_value, job.cv.language)
        content = overlay_actor_identity(content, job.user, fill_only=True)
        # Màu ứng viên chọn khi upload nằm ở bản nháp ban đầu do create_v2_cv tạo.
        draft = CvDraft.objects.filter(cv_id=job.cv_id).only('style_json').first()
        theme_color = (draft.style_json or {}).get('theme_color') if draft else None
        document = compose_cv_document(
            template=job.cv.template,
            content_json=content,
            theme_color=theme_color,
        )
        with transaction.atomic():
            current = (
                CvImportJob.objects.select_for_update().select_related('cv', 'user').get(pk=job_id)
            )
            if current.status != CvImportJob.Status.PROCESSING:
                return
            version = create_version(
                cv=current.cv,
                actor=current.user,
                content_json=document['content_json'],
                layout_json=document['layout_json'],
                style_json=document['style_json'],
                version_kind='imported',
                template_version=current.cv.template.current_published_version,
                create_or_replace_draft=True,
            )
            now = timezone.now()
            UserCv.objects.filter(pk=current.cv_id).update(
                processing_status=UserCv.ProcessingStatus.ANALYZED,
                error_message='',
                updated_at=now,
            )
            current.status = CvImportJob.Status.COMPLETED
            current.result_version = version
            current.failure_code = ''
            current.completed_at = now
            current.failed_at = None
            current.save(
                update_fields=[
                    'status',
                    'result_version',
                    'failure_code',
                    'completed_at',
                    'failed_at',
                    'updated_at',
                ]
            )
            duration_ms = (
                (now - current.started_at).total_seconds() * 1000 if current.started_at else 0
            )
            record_metric('cv_import_duration_ms', round(duration_ms, 2), status='completed')
    except ImportProcessingError as error:
        _fail_import(job_id, error.code)
    except AiCvParseError as error:
        _fail_import(job_id, error.code)
    except Exception:  # noqa: BLE001 - never log raw text or provider response
        logger.warning('CV import job %s failed.', job_id)
        _fail_import(job_id, 'import_processing_failed')


@shared_task
def dispatch_pending_cv_import_jobs():
    for job_id in CvImportJob.objects.filter(status=CvImportJob.Status.QUEUED).values_list(
        'pk', flat=True
    )[:100]:
        process_cv_import_job.delay(job_id)


@shared_task
def purge_expired_cv_import_sources():
    for job in (
        CvImportJob.objects.select_related('cv')
        .filter(
            source_expires_at__lte=timezone.now(),
            status__in=[CvImportJob.Status.COMPLETED, CvImportJob.Status.FAILED],
        )
        .exclude(cv__file_url='')
        .iterator()
    ):
        storage_key = job.cv.file_url
        from apps.cvs.services.upload_claims import (
            CV_SOURCE_CLAIM_SCOPE,
            claimed_candidate_upload,
            release_candidate_cv_source,
        )

        claimed_source = claimed_candidate_upload(
            claim_scope=CV_SOURCE_CLAIM_SCOPE,
            claim_reference=job.cv.public_id,
        )
        if claimed_source is not None:
            release_candidate_cv_source(owner=job.user, cv_public_id=job.cv.public_id)
        elif default_storage.exists(storage_key):
            default_storage.delete(storage_key)
        UserCv.objects.filter(pk=job.cv_id, file_url=storage_key).update(
            file_url='', updated_at=timezone.now()
        )
