"""Write workflows for candidate-owned CVs."""

from uuid import uuid4

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from ..models import UserCv
from .versions import create_initial_document, sync_legacy_builder_draft

ALLOWED_UPLOAD_TYPES = {'pdf', 'docx'}


class UnsupportedCvUpload(ValueError):
    """Raised when an upload is not a supported CV document."""


@transaction.atomic
def create_builder_cv(serializer, user):
    cv = serializer.save(
        user=user,
        cv_type=UserCv.CvType.BUILDER,
        source=UserCv.Source.BUILDER,
    )
    create_initial_document(cv, user)
    return cv


@transaction.atomic
def archive_cv(instance):
    instance.is_deleted = True
    instance.deleted_at = timezone.now()
    instance.save(update_fields=['is_deleted', 'deleted_at'])


def upload_cv(user, upload, title=''):
    file_type = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
    if file_type not in ALLOWED_UPLOAD_TYPES:
        raise UnsupportedCvUpload('Only PDF or DOCX files are supported.')

    path = default_storage.save(f'cvs/uploads/{user.public_id}/{uuid4().hex}.{file_type}', upload)
    try:
        with transaction.atomic():
            cv = UserCv.objects.create(
                user=user,
                cv_type=UserCv.CvType.UPLOADED,
                source=UserCv.Source.UPLOADED,
                title=title or upload.name,
                file_url=path,
                file_name=upload.name,
                file_type=file_type,
                status=UserCv.Status.UPLOADED,
            )
            create_initial_document(cv, user, version_kind='imported')
            return cv
    except Exception:
        default_storage.delete(path)
        raise


def update_builder_cv(serializer, user):
    """Persist legacy fields and mirror them into the V2 mutable draft."""
    cv = serializer.save()
    sync_legacy_builder_draft(cv, user)
    return cv
