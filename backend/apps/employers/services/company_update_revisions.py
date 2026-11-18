"""Immutable revisions of a company update request and their staleness checks.

Each submission is frozen as a ``CompanyUpdateRevision`` together with the
published values it was based on, so review can tell which fields changed
underneath the requester.
"""

from apps.accounts.services import StaleImpactToken

from ..models import (
    CompanyMediaUpload,
    CompanyUpdateEvent,
    CompanyUpdateRevision,
)
from .company_page_content import (
    company_benefit_values,
    company_office_values,
)


class CompanyUpdateConflict(Exception):
    """One or more requested fields changed after the requester snapshot."""

    def __init__(self, fields):
        self.fields = tuple(sorted(set(fields)))
        super().__init__('Thông tin công ty đã thay đổi ở các trường đang được yêu cầu cập nhật.')


def company_update_field_value(company, field):
    if field == 'industries':
        return list(
            company.company_industries.order_by('industry_id').values_list(
                'industry_id',
                flat=True,
            )
        )
    if field == 'primary_industry':
        return (
            company.company_industries.filter(is_primary=True)
            .values_list('industry_id', flat=True)
            .first()
        )
    if field == 'benefits':
        return company_benefit_values(company)
    if field == 'offices':
        return company_office_values(company)
    if field in {'gallery_additions', 'gallery_deletions'}:
        return list(company.images.order_by('id').values_list('id', flat=True))
    if field.endswith('_pending'):
        return None
    return getattr(company, field, None)


def capture_company_update_base_values(company, changes):
    return {
        field: company_update_field_value(company, field)
        for field in changes
        if not field.endswith('_pending')
    }


def _current_request_media(update_request):
    changes = update_request.changes or {}
    paths = {
        value
        for value in (
            changes.get('logo_url'),
            changes.get('cover_image_url'),
            *(changes.get('gallery_additions') or []),
        )
        if value
    }
    if not paths:
        return CompanyMediaUpload.objects.none()
    return update_request.media_upload_records.filter(public_path__in=paths)


def snapshot_company_update_request(
    update_request,
    *,
    actor,
    event_type=CompanyUpdateEvent.EventType.REVISION_CREATED,
    base_company_updated_at=None,
    base_values=None,
    payload=None,
):
    """Append one immutable snapshot after the caller locks Company → Request."""
    has_revision = update_request.revisions.exists()
    number = update_request.revision + 1 if has_revision else max(update_request.revision, 1)
    update_request.revision = number
    if base_company_updated_at is not None:
        update_request.base_company_updated_at = base_company_updated_at
    if base_values is not None:
        update_request.base_values = base_values
    update_request.lock_version += 1
    update_request.save(
        update_fields=[
            'revision',
            'base_company_updated_at',
            'base_values',
            'lock_version',
            'updated_at',
        ]
    )
    revision = CompanyUpdateRevision.objects.create(
        update_request=update_request,
        number=number,
        submitted_by=actor,
        changes=update_request.changes,
        reason=update_request.reason,
        proof_type=update_request.proof_type,
        base_company_updated_at=(
            update_request.base_company_updated_at or update_request.company.updated_at
        ),
        base_values=update_request.base_values,
        submitted_at=update_request.submitted_at,
    )
    update_request.current_revision = revision
    update_request.save(update_fields=['current_revision', 'updated_at'])
    current_documents = update_request.documents.filter(is_current=True)
    current_media = _current_request_media(update_request)
    revision.documents.set(current_documents)
    revision.media_uploads.set(current_media)
    current_documents.update(update_revision=revision)
    current_media.update(update_revision=revision)
    CompanyUpdateEvent.objects.create(
        update_request=update_request,
        actor=actor,
        event_type=event_type,
        revision_number=number,
        payload={
            'changed_fields': sorted((update_request.changes or {}).keys()),
            **(payload or {}),
        },
    )
    return revision


def current_company_update_revision(update_request):
    revision = update_request.current_revision
    if revision is not None and revision.number == update_request.revision:
        return revision
    return update_request.revisions.filter(number=update_request.revision).first()


def validate_company_update_revision(update_request, revision_public_id=''):
    revision = current_company_update_revision(update_request)
    if revision is None and not revision_public_id:
        revision = snapshot_company_update_request(
            update_request,
            actor=update_request.requested_by,
            base_company_updated_at=(
                update_request.base_company_updated_at or update_request.company.updated_at
            ),
            base_values=(
                update_request.base_values
                or capture_company_update_base_values(
                    update_request.company,
                    update_request.changes,
                )
            ),
            payload={'compatibility_snapshot': True},
        )
    if revision is None:
        raise StaleImpactToken('Yêu cầu chưa có revision hiện hành. Vui lòng tải lại.')
    if revision_public_id and revision.public_id != revision_public_id:
        raise StaleImpactToken('Phiên yêu cầu đã thay đổi. Vui lòng tải lại.')
    return revision


def company_update_conflicting_fields(company, revision):
    return [
        field
        for field, base_value in (revision.base_values or {}).items()
        if company_update_field_value(company, field) != base_value
    ]
