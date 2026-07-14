"""Write workflows for candidate-owned CVs."""

from copy import deepcopy
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from ..models import CvVersion, UserCv
from .versions import create_initial_document, create_version, sync_legacy_builder_draft

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
    """Archive a CV consistently for both legacy and V2 callers."""
    cv = UserCv.objects.select_for_update().get(pk=instance.pk)
    if cv.is_deleted:
        return cv
    archived_at = timezone.now()
    cv.is_deleted = True
    cv.deleted_at = archived_at
    cv.archived_at = archived_at
    cv.lifecycle_status = UserCv.LifecycleStatus.ARCHIVED
    cv.is_default = False
    cv.save(update_fields=[
        'is_deleted', 'deleted_at', 'archived_at', 'lifecycle_status', 'is_default', 'updated_at',
    ])
    return cv


@transaction.atomic
def restore_cv(*, cv, actor):
    """Restore an explicitly selected archived CV within the retention window."""
    locked_cv = UserCv.objects.select_for_update().get(pk=cv.pk)
    if locked_cv.user_id != actor.pk:
        raise ValueError('Only the CV owner can restore it.')
    if not locked_cv.is_deleted or locked_cv.lifecycle_status != UserCv.LifecycleStatus.ARCHIVED:
        raise ValueError('Only archived CVs can be restored.')
    if locked_cv.archived_at is None:
        raise ValueError('Archived CV is missing its archive timestamp.')
    restore_deadline = locked_cv.archived_at + timedelta(days=settings.CV_ARCHIVE_RESTORE_WINDOW_DAYS)
    if timezone.now() > restore_deadline:
        raise ValueError('The archive restore window has expired.')

    locked_cv.is_deleted = False
    locked_cv.deleted_at = None
    locked_cv.archived_at = None
    locked_cv.is_default = False
    locked_cv.lifecycle_status = (
        UserCv.LifecycleStatus.PUBLISHED
        if locked_cv.published_version_id
        else UserCv.LifecycleStatus.DRAFT
    )
    locked_cv.save(update_fields=[
        'is_deleted', 'deleted_at', 'archived_at', 'is_default', 'lifecycle_status', 'updated_at',
    ])
    return locked_cv


def upload_cv(user, upload, title='', *, source=UserCv.Source.UPLOADED):
    file_type = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
    if file_type not in ALLOWED_UPLOAD_TYPES:
        raise UnsupportedCvUpload('Only PDF or DOCX files are supported.')

    path = default_storage.save(f'cvs/uploads/{user.public_id}/{uuid4().hex}.{file_type}', upload)
    try:
        with transaction.atomic():
            cv = UserCv.objects.create(
                user=user,
                cv_type=UserCv.CvType.UPLOADED,
                source=source,
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


def import_v2_cv(actor, upload, title=''):
    """Create an uploaded CV through the explicit V2 import contract."""
    return upload_cv(actor, upload, title, source=UserCv.Source.IMPORTED)


@transaction.atomic
def duplicate_cv(*, cv, actor, title=''):
    """Copy a builder CV's latest immutable version into a new independent draft."""
    source_cv = UserCv.objects.select_for_update(of=('self',)).select_related(
        'template', 'position', 'latest_version__template_version',
    ).get(pk=cv.pk)
    if source_cv.user_id != actor.pk:
        raise ValueError('Only the CV owner can duplicate it.')
    if source_cv.is_deleted:
        raise ValueError('Archived CVs must be restored before duplication.')
    if source_cv.cv_type != UserCv.CvType.BUILDER:
        raise ValueError('Only builder CVs can be duplicated.')
    source_version = source_cv.latest_version
    if source_version is None:
        raise ValueError('This CV has no immutable version to duplicate.')

    content_json = deepcopy(source_version.content_json)
    layout_json = deepcopy(source_version.layout_json)
    style_json = deepcopy(source_version.style_json)
    duplicate = UserCv.objects.create(
        user=actor,
        template=source_cv.template,
        position=source_cv.position,
        cv_type=UserCv.CvType.BUILDER,
        source=UserCv.Source.BUILDER,
        title=title or f'{source_cv.title} (copy)',
        language=source_cv.language,
        cv_data=content_json,
        style_config=style_json,
    )
    create_version(
        cv=duplicate,
        actor=actor,
        content_json=content_json,
        layout_json=layout_json,
        style_json=style_json,
        version_kind=CvVersion.VersionKind.INITIAL,
        template_version=source_version.template_version,
        parent_version=None,
        create_or_replace_draft=True,
    )
    return UserCv.objects.select_related(
        'template', 'current_template_version', 'latest_version', 'published_version',
    ).get(pk=duplicate.pk)


@transaction.atomic
def update_cv_metadata(*, cv, actor, title=None, is_default=None):
    """Update the small mutable CV aggregate owned by the candidate.

    Draft document changes intentionally stay on the optimistic-locking draft
    endpoint.  The account library only needs a title and one active default
    CV, so this service makes those invariants explicit.
    """
    locked_cv = UserCv.objects.select_for_update().get(pk=cv.pk)
    if locked_cv.user_id != actor.pk:
        raise ValueError('Only the CV owner can update its metadata.')

    if is_default is True:
        # Serialise updates across a candidate's CVs.  The database constraint
        # below remains the final guard if this service is ever bypassed.
        actor.__class__.objects.select_for_update().get(pk=actor.pk)
        UserCv.objects.filter(user_id=actor.pk, is_deleted=False, is_default=True).exclude(
            pk=locked_cv.pk,
        ).update(is_default=False)

    update_fields = []
    if title is not None and locked_cv.title != title:
        locked_cv.title = title
        update_fields.append('title')
    if is_default is not None and locked_cv.is_default != is_default:
        locked_cv.is_default = is_default
        update_fields.append('is_default')
    if update_fields:
        locked_cv.save(update_fields=[*update_fields, 'updated_at'])
    return locked_cv


def update_builder_cv(serializer, user):
    """Persist legacy fields and mirror them into the V2 mutable draft."""
    cv = serializer.save()
    sync_legacy_builder_draft(cv, user)
    return cv
