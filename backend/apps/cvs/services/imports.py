from datetime import timedelta
from hashlib import sha256
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from apps.cv_templates.models import CvTemplate

from ..models import CvImportJob, UserCv
from .lifecycle import create_v2_cv


MAX_IMPORT_BYTES = 5 * 1024 * 1024


class InvalidCvImport(ValueError):
    pass


def validate_import_upload(upload):
    if upload.size > MAX_IMPORT_BYTES:
        raise InvalidCvImport('File must not exceed 5 MB.')
    extension = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
    upload.seek(0)
    signature = upload.read(1024)
    upload.seek(0)
    # ISO 32000 readers accept the PDF header within the first 1024 bytes.
    # Some document generators prepend a BOM or transport whitespace.
    if extension == 'pdf' and b'%PDF-' in signature:
        return extension
    if extension == 'docx' and signature.startswith(b'PK'):
        try:
            with ZipFile(upload) as archive:
                names = set(archive.namelist())
                if '[Content_Types].xml' in names and 'word/document.xml' in names:
                    upload.seek(0)
                    return extension
        except BadZipFile:
            pass
        finally:
            upload.seek(0)
    raise InvalidCvImport('Tệp phải là PDF hoặc DOCX hợp lệ.')


def _checksum(upload):
    digest = sha256()
    upload.seek(0)
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)
    return digest.hexdigest()


def queue_cv_import(*, actor, upload, template, language, theme_color=None, title='', idempotency_key=''):
    file_type = validate_import_upload(upload)
    key = (idempotency_key or uuid4().hex)[:100]
    existing = CvImportJob.objects.select_related('cv').filter(user=actor, idempotency_key=key).first()
    if existing:
        return existing.cv, existing, False
    checksum = _checksum(upload)
    storage_key = default_storage.save(
        f'cvs/imports/{actor.public_id}/{uuid4().hex}.{file_type}', upload,
    )
    try:
        with transaction.atomic():
            cv = create_v2_cv(
                actor=actor,
                title=title or upload.name,
                template=template,
                language=language,
                theme_color=theme_color,
            )
            cv.source = UserCv.Source.IMPORTED
            cv.cv_type = UserCv.CvType.BUILDER
            cv.file_url = storage_key
            cv.file_name = upload.name[:255]
            cv.file_type = file_type
            cv.status = UserCv.Status.PROCESSING
            cv.processing_status = UserCv.ProcessingStatus.QUEUED
            cv.save(update_fields=[
                'source', 'cv_type', 'file_url', 'file_name', 'file_type',
                'status', 'processing_status', 'updated_at',
            ])
            job = CvImportJob.objects.create(
                cv=cv,
                user=actor,
                idempotency_key=key,
                file_checksum_sha256=checksum,
                source_expires_at=timezone.now() + timedelta(
                    days=getattr(settings, 'CV_IMPORT_SOURCE_RETENTION_DAYS', 30),
                ),
            )
            from ..tasks import process_cv_import_job

            transaction.on_commit(lambda: process_cv_import_job.delay(job.pk))
        return cv, job, True
    except Exception:
        default_storage.delete(storage_key)
        raise


@transaction.atomic
def retry_import(*, cv, actor):
    job = CvImportJob.objects.select_for_update().select_related('cv').get(cv=cv)
    if job.user_id != actor.pk:
        raise InvalidCvImport('Only the import owner can retry it.')
    if job.status != CvImportJob.Status.FAILED:
        raise InvalidCvImport('Only a failed import can be retried.')
    if job.attempts >= 3:
        raise InvalidCvImport('The retry limit has been reached.')
    job.status = CvImportJob.Status.QUEUED
    job.failure_code = ''
    job.failed_at = None
    job.save(update_fields=['status', 'failure_code', 'failed_at', 'updated_at'])
    cv.processing_status = UserCv.ProcessingStatus.QUEUED
    cv.status = UserCv.Status.PROCESSING
    cv.error_message = ''
    cv.save(update_fields=['processing_status', 'status', 'error_message', 'updated_at'])
    from ..tasks import process_cv_import_job

    transaction.on_commit(lambda: process_cv_import_job.delay(job.pk))
    return job
