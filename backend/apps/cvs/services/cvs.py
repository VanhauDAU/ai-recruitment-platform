"""Write workflows for candidate-owned CVs."""

from copy import deepcopy
from io import BytesIO
from uuid import uuid4

from django.core.files.storage import default_storage
from django.db import transaction

from common.office_preview import DOCX_CONTENT_TYPE, render_office_document_preview
from common.r2_storage import private_media_storage

from ..models import CvAccessLog, CvExport, CvSharedLink, CvVersion, UserCv
from .cv_document import read_cv_document
from .imports import validate_import_upload
from .quota import ensure_cv_quota
from .recruiter_search import RecruiterConsentRequired, recruiter_visibility_granted
from .upload_claims import (
    CV_SOURCE_CLAIM_SCOPE,
    claim_candidate_upload,
    claimed_candidate_upload,
    open_clean_candidate_upload,
    release_candidate_cv_source,
)
from .versions import create_initial_document, create_version

ALLOWED_UPLOAD_TYPES = {'pdf', 'docx'}


class UnsupportedCvUpload(ValueError):
    """Raised when an upload is not a supported CV document."""


def _delete_storage_keys(keys):
    for key in {key for key in keys if key}:
        try:
            default_storage.delete(key)
        except Exception:
            # Database deletion is authoritative. A storage retry/retention job
            # can clean an unavailable object store without retaining the CV.
            pass


@transaction.atomic
def permanently_delete_cv(*, cv, actor):
    """Permanently remove one owner CV and all library-only artifacts.

    A submitted application is legally/product-wise independent of the user's
    library. Its immutable application snapshot is retained, but detached from
    the removed CV aggregate; every other version, draft, share, export, import
    source and access log is deleted.
    """
    from apps.applications.models import Application

    locked_cv = UserCv.objects.select_for_update().get(pk=cv.pk)
    if locked_cv.user_id != actor.pk:
        raise ValueError('Only the CV owner can permanently delete it.')

    applications = Application.objects.filter(cv=locked_cv).select_related('submitted_cv_version')
    snapshot_ids = list(applications.values_list('submitted_cv_version_id', flat=True))
    if applications.exclude(
        submitted_cv_version__version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT,
    ).exists():
        raise ValueError('Cannot delete a CV with an invalid application snapshot.')

    source_asset = claimed_candidate_upload(
        claim_scope=CV_SOURCE_CLAIM_SCOPE,
        claim_reference=locked_cv.public_id,
    )
    storage_keys = [locked_cv.thumbnail_url]
    if source_asset is None:
        storage_keys.append(locked_cv.file_url)
    exports = CvExport.objects.filter(cv=locked_cv)
    storage_keys.extend(exports.values_list('storage_key', flat=True))

    # These rows protect immutable versions at the database layer; remove
    # library-owned artifacts before deleting their owning aggregate.
    CvAccessLog.objects.filter(cv=locked_cv).delete()
    CvSharedLink.objects.filter(cv=locked_cv).delete()
    exports.delete()

    # Application snapshot rows remain but no longer point to an active library
    # CV. `CvVersion.cv` is SET_NULL for exactly this retention boundary.
    applications.update(cv=None)
    CvVersion.objects.filter(cv=locked_cv).exclude(pk__in=snapshot_ids).delete()
    cv_public_id = locked_cv.public_id
    locked_cv.delete()
    if source_asset is not None:
        release_candidate_cv_source(owner=actor, cv_public_id=cv_public_id)
    transaction.on_commit(lambda: _delete_storage_keys(storage_keys))


def upload_cv(user, upload, title='', *, source=UserCv.Source.UPLOADED):
    file_type = upload.name.rsplit('.', 1)[-1].lower() if '.' in upload.name else ''
    if file_type not in ALLOWED_UPLOAD_TYPES:
        raise UnsupportedCvUpload('Only PDF or DOCX files are supported.')
    read_cv_document(upload, file_type)

    path = default_storage.save(f'cvs/uploads/{user.public_id}/{uuid4().hex}.{file_type}', upload)
    try:
        with transaction.atomic():
            ensure_cv_quota(user)
            cv = UserCv.objects.create(
                user=user,
                cv_type=UserCv.CvType.UPLOADED,
                source=source,
                title=title or upload.name,
                file_url=path,
                file_name=upload.name,
                file_type=file_type,
            )
            create_initial_document(cv, user, version_kind='imported')
            return cv
    except Exception:
        default_storage.delete(path)
        raise


def import_v2_cv(actor, upload, title=''):
    """Create an uploaded CV through the explicit V2 import contract."""
    return upload_cv(actor, upload, title, source=UserCv.Source.IMPORTED)


def _open_source_pdf(file_key, file_type):
    """A stored CV file as a PDF stream; DOCX is converted on the fly. None if unreadable."""
    if not file_key:
        return None
    if file_type == 'docx':
        preview = render_office_document_preview(file_key, DOCX_CONTENT_TYPE)
        return BytesIO(preview) if preview is not None else None
    if file_type != 'pdf':
        return None
    try:
        return private_media_storage().open(file_key, 'rb')
    except OSError:
        return None


def open_uploaded_cv_pdf(cv):
    """Open an uploaded CV's original file as a PDF stream for its owner."""
    if cv.cv_type != UserCv.CvType.UPLOADED:
        return None
    return _open_source_pdf(cv.file_url, cv.file_type)


def open_snapshot_source_pdf(version):
    """The file submitted with an application, as a PDF stream; None for builder CVs."""
    return _open_source_pdf(version.source_file_key, version.source_file_type)


@transaction.atomic
def import_v2_cv_from_session(*, actor, upload_session_public_id, title=''):
    """Create an uploaded CV from a scanner-approved private object."""
    ensure_cv_quota(actor)
    cv = UserCv.objects.create(
        user=actor,
        cv_type=UserCv.CvType.UPLOADED,
        source=UserCv.Source.IMPORTED,
        title=title or 'CV đã tải lên',
    )
    asset = claim_candidate_upload(
        owner=actor,
        session_public_id=upload_session_public_id,
        claim_scope=CV_SOURCE_CLAIM_SCOPE,
        claim_reference=cv.public_id,
    )
    with open_clean_candidate_upload(asset) as upload:
        # Cùng chuẩn với upload trực tiếp: định dạng/chữ ký, dung lượng, nội dung là CV.
        file_type = validate_import_upload(upload)
        read_cv_document(upload, file_type)

    cv.title = title or asset.original_filename
    cv.file_url = asset.storage_key
    cv.file_name = asset.original_filename[:255]
    cv.file_type = file_type
    cv.save(update_fields=['title', 'file_url', 'file_name', 'file_type', 'updated_at'])
    create_initial_document(cv, actor, version_kind='imported')
    return cv


@transaction.atomic
def duplicate_cv(*, cv, actor, title=''):
    """Copy a builder CV's latest immutable version into a new independent draft."""
    source_cv = (
        UserCv.objects.select_for_update(of=('self',))
        .select_related(
            'template',
            'position',
            'latest_version__template_version',
        )
        .get(pk=cv.pk)
    )
    if source_cv.user_id != actor.pk:
        raise ValueError('Only the CV owner can duplicate it.')
    if source_cv.is_deleted:
        raise ValueError('Archived CVs must be restored before duplication.')
    if source_cv.cv_type != UserCv.CvType.BUILDER:
        raise ValueError('Only builder CVs can be duplicated.')
    source_version = source_cv.latest_version
    if source_version is None:
        raise ValueError('This CV has no immutable version to duplicate.')
    ensure_cv_quota(actor)

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
        'template',
        'current_template_version',
        'latest_version',
        'published_version',
    ).get(pk=duplicate.pk)


UNCHANGED = object()


@transaction.atomic
def update_cv_metadata(
    *,
    cv,
    actor,
    title=None,
    is_default=None,
    position=UNCHANGED,
    position_level=None,
    recruiter_searchable=None,
):
    """Update the small mutable CV aggregate owned by the candidate.

    Draft document changes intentionally stay on the optimistic-locking draft
    endpoint.  The account library only needs a title and one active default
    CV, so this service makes those invariants explicit.  The target position
    (`JobCategory`, ``None`` clears it) and desired `Job.PositionLevel` are the
    candidate-chosen matching fields of CVT-3; they are never printed on the CV.
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
    if position is not UNCHANGED and locked_cv.position_id != getattr(position, 'pk', None):
        locked_cv.position = position
        update_fields.append('position')
    if position_level is not None and locked_cv.position_level != position_level:
        locked_cv.position_level = position_level
        update_fields.append('position_level')
    if recruiter_searchable is not None and locked_cv.recruiter_searchable != recruiter_searchable:
        if recruiter_searchable and not recruiter_visibility_granted(actor):
            raise RecruiterConsentRequired()
        locked_cv.recruiter_searchable = recruiter_searchable
        update_fields.append('recruiter_searchable')
    if update_fields:
        locked_cv.save(update_fields=[*update_fields, 'updated_at'])
    return locked_cv
