"""Owner-scoped immutable CV PDF export orchestration."""

from __future__ import annotations

import json
import logging
from hashlib import sha256

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from apps.cv_templates.renderers import validate_renderer_contract

from ..models import CvAccessLog, CvExport, CvVersion, UserCv
from .audit import record_cv_access

logger = logging.getLogger(__name__)


class CvExportPermissionError(ValueError):
    """The actor is not allowed to export the requested CV/version."""


class CvExportUnavailableError(ValueError):
    """An export is absent or outside the owner-scoped aggregate."""


class CvExportStateError(ValueError):
    """The requested export transition is not valid for its current state."""


def _assert_owner(cv: UserCv, actor) -> None:
    if cv.user_id != actor.pk:
        raise CvExportPermissionError('Only the CV owner can export this CV.')


def _render_config(version: CvVersion) -> dict:
    template_version = version.template_version
    if template_version is None:
        raise CvExportPermissionError('This CV version has no pinned template renderer.')
    regions = [
        region.get('id')
        for region in version.layout_json.get('regions', [])
        if isinstance(region, dict)
    ]
    contract = validate_renderer_contract(
        template_version.renderer_key,
        version.schema_version,
        regions,
    )
    if template_version.renderer_version != contract.version:
        raise CvExportPermissionError('This CV version uses an unavailable renderer version.')
    # It is intentional that this contains no CV JSON. The paired immutable
    # version FK selects content/layout/style, while this hash selects output.
    return {
        'format': CvExport.ExportFormat.PDF,
        'renderer_key': contract.key,
        'renderer_version': contract.version,
        'schema_version': version.schema_version,
        'page_size': 'A4',
        'engine': 'weasyprint_html_v1',
    }


def _render_config_hash(render_config: dict) -> str:
    encoded = json.dumps(render_config, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return sha256(encoded).hexdigest()


def _artifact_is_valid(export: CvExport) -> bool:
    return (
        export.status == CvExport.Status.COMPLETED
        and bool(export.storage_key)
        and bool(export.checksum_sha256)
        and default_storage.exists(export.storage_key)
    )


def _dispatch_after_commit(export_id: int) -> None:
    """Use a transaction outbox-style callback so workers never see uncommitted jobs."""

    def dispatch():
        try:
            from apps.cvs.tasks import render_cv_export_job

            render_cv_export_job.delay(export_id)
        except Exception:  # noqa: BLE001 - persisted pending row remains recoverable by worker dispatch
            logger.exception('Unable to enqueue CV PDF export %s.', export_id)

    transaction.on_commit(dispatch)


def _record_export_audit(cv, version, actor, request) -> None:
    record_cv_access(
        cv=cv,
        version=version,
        actor_type=CvAccessLog.ActorType.OWNER,
        access_channel=CvAccessLog.AccessChannel.EXPORT,
        request=request,
        actor_user=actor,
    )


def _select_version(cv: UserCv, version_public_id: str | None) -> CvVersion:
    versions = CvVersion.objects.select_related('template_version').filter(cv=cv)
    if version_public_id:
        version = versions.filter(public_id=version_public_id).first()
    else:
        version_id = cv.published_version_id or cv.latest_version_id
        version = versions.filter(pk=version_id).first() if version_id else None
    if version is None:
        raise CvExportPermissionError('Select an immutable CV version owned by this CV.')
    return version


@transaction.atomic
def request_cv_export(
    *, cv: UserCv, actor, request, version_public_id: str | None = None
) -> tuple[CvExport, bool]:
    """Create one PDF job or reuse the valid artifact for the exact render spec."""
    cv = UserCv.objects.select_for_update(of=('self',)).get(pk=cv.pk)
    _assert_owner(cv, actor)
    if cv.is_deleted:
        raise CvExportUnavailableError('This CV is unavailable.')
    version = _select_version(cv, version_public_id)
    render_config = _render_config(version)
    config_hash = _render_config_hash(render_config)
    export = (
        CvExport.objects.select_for_update()
        .filter(
            version=version,
            render_config_hash=config_hash,
        )
        .first()
    )
    dispatch = False
    reused = export is not None
    if export is None:
        export = CvExport.objects.create(
            cv=cv,
            version=version,
            export_format=CvExport.ExportFormat.PDF,
            renderer_key=render_config['renderer_key'],
            renderer_version=render_config['renderer_version'],
            render_config=render_config,
            render_config_hash=config_hash,
            requested_by=actor,
        )
        dispatch = True
    elif export.status == CvExport.Status.COMPLETED and not _artifact_is_valid(export):
        # A missing/corrupt object is never reusable. Preserve the job identity
        # and queue a new attempt rather than returning a dead download URL.
        export.status = CvExport.Status.PENDING
        export.storage_key = ''
        export.file_size_bytes = None
        export.checksum_sha256 = ''
        export.last_error = ''
        export.started_at = None
        export.completed_at = None
        export.failed_at = None
        export.queued_at = timezone.now()
        export.save(
            update_fields=[
                'status',
                'storage_key',
                'file_size_bytes',
                'checksum_sha256',
                'last_error',
                'started_at',
                'completed_at',
                'failed_at',
                'queued_at',
                'updated_at',
            ]
        )
        dispatch = True
        reused = False
    _record_export_audit(cv, version, actor, request)
    if dispatch:
        _dispatch_after_commit(export.pk)
    return export, reused


@transaction.atomic
def retry_cv_export(*, cv: UserCv, actor, request, export_public_id: str) -> CvExport:
    """Requeue only a failed owner-scoped job without changing its source version."""
    cv = UserCv.objects.select_for_update(of=('self',)).get(pk=cv.pk)
    _assert_owner(cv, actor)
    try:
        export = (
            CvExport.objects.select_for_update()
            .select_related('version')
            .get(
                cv=cv,
                public_id=export_public_id,
            )
        )
    except CvExport.DoesNotExist as error:
        raise CvExportUnavailableError('Export does not exist.') from error
    if export.status != CvExport.Status.FAILED:
        raise CvExportStateError('Only failed exports can be retried.')
    export.status = CvExport.Status.PENDING
    export.storage_key = ''
    export.file_size_bytes = None
    export.checksum_sha256 = ''
    export.last_error = ''
    export.started_at = None
    export.completed_at = None
    export.failed_at = None
    export.queued_at = timezone.now()
    export.save(
        update_fields=[
            'status',
            'storage_key',
            'file_size_bytes',
            'checksum_sha256',
            'last_error',
            'started_at',
            'completed_at',
            'failed_at',
            'queued_at',
            'updated_at',
        ]
    )
    _record_export_audit(cv, export.version, actor, request)
    _dispatch_after_commit(export.pk)
    return export


def owner_cv_export(*, cv: UserCv, actor, export_public_id: str) -> CvExport:
    """Resolve an export through both CV and owner SQL scopes to prevent IDOR."""
    _assert_owner(cv, actor)
    try:
        return CvExport.objects.select_related('version').get(cv=cv, public_id=export_public_id)
    except CvExport.DoesNotExist as error:
        raise CvExportUnavailableError('Export does not exist.') from error


def export_download_ready(export: CvExport) -> bool:
    """Avoid exposing a URL whenever the completed artifact no longer exists."""
    return _artifact_is_valid(export)
