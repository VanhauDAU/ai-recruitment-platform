"""Submitting a company update request (ER-D48: one open request per requester).

The profile form replaces the caller's open request with what it sends; the
page workspace (``merge=True``) only adds or changes the keys it sends, so an
editor can save one block at a time.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from common.media_storage import delete_local_media_url

from ..models import Company, CompanyDocument, CompanyUpdateEvent, CompanyUpdateRequest
from ..models.verification import ACTIVE_COMPANY_UPDATE_STATUSES
from .companies import (
    UPDATABLE_COMPANY_FIELDS,
    CompanyUpdateConflict,
    capture_company_update_base_values,
    close_company_update_before_review,
    company_update_field_value,
    snapshot_company_update_request,
)
from .tax_lookup import queue_company_tax_lookup

# Keys a merge compares with the published value; staged media and markers
# describe uploads, not values, and are always kept.
PUBLISHED_COMPARABLE_FIELDS = UPDATABLE_COMPANY_FIELDS | {'benefits', 'offices'}


class CompanyUpdateInReview(Exception):
    """The caller's open request is being reviewed and is read-only."""


def lock_company_update_target(*, company_id, requester):
    """Lock Company → the requester's open request; call inside a transaction."""
    company = Company.objects.select_for_update().get(pk=company_id)
    active_request = (
        CompanyUpdateRequest.objects.select_for_update()
        .filter(
            company=company,
            requested_by=requester,
            status__in=ACTIVE_COMPANY_UPDATE_STATUSES,
        )
        .first()
    )
    if (
        active_request is not None
        and active_request.status == CompanyUpdateRequest.Status.IN_REVIEW
    ):
        raise CompanyUpdateInReview
    return company, active_request


def _is_published(company, field, value):
    if field == 'gallery_deletions':
        return not value
    return (
        field in PUBLISHED_COMPARABLE_FIELDS and company_update_field_value(company, field) == value
    )


def _merged_changes(company, active_request, incoming):
    """Changes and base values after merging ``incoming`` into the open request.

    A key sent with its published value leaves the request. Kept keys keep the
    base value captured when they were first sent, so a change published in
    between still shows up as a conflict at review.
    """
    previous = dict(active_request.changes) if active_request is not None else {}
    kept = {field: value for field, value in previous.items() if field not in incoming}
    sent = {
        field: value
        for field, value in incoming.items()
        if not _is_published(company, field, value)
    }
    previous_base = active_request.base_values if active_request is not None else {}
    base_values = {field: value for field, value in (previous_base or {}).items() if field in kept}
    base_values.update(capture_company_update_base_values(company, sent))
    return {**kept, **sent}, base_values


def _replaced_changes(company, active_request, changes):
    """Changes and base values when the profile form replaces the open request."""
    staged_paths_to_delete = []
    if active_request is not None:
        previous = active_request.changes
        if 'logo_url' in previous and not changes.get('has_no_logo'):
            changes['logo_url'] = previous['logo_url']
        elif 'logo_url' in previous:
            staged_paths_to_delete.append(previous['logo_url'])
        if 'cover_image_url' in previous:
            changes['cover_image_url'] = previous['cover_image_url']
        if 'gallery_additions' in previous:
            changes['gallery_additions'] = previous['gallery_additions']
    return changes, capture_company_update_base_values(company, changes), staged_paths_to_delete


def _withdraw_emptied_request(active_request, requester):
    close_company_update_before_review(
        active_request,
        actor=requester,
        action=CompanyUpdateRequest.Status.WITHDRAWN,
        reason='',
        lock_version=active_request.lock_version,
    )


def submit_company_update_request(
    *,
    company,
    active_request,
    requester,
    data,
    expected_base_updated_at=None,
    merge=False,
):
    """Create or revise the requester's open request; returns ``(request, created)``.

    ``company`` and ``active_request`` come from ``lock_company_update_target``
    in the caller's transaction; ``data`` holds validated ``changes`` and, for
    the profile form, ``reason``, ``proof_type`` and ``is_sensitive``. A merge
    that leaves nothing to review withdraws the open request and returns
    ``(None, False)``.
    """
    if expected_base_updated_at and company.updated_at != expected_base_updated_at:
        raise CompanyUpdateConflict(['company_version'])
    staged_paths_to_delete = []
    if merge:
        changes, base_values = _merged_changes(company, active_request, data['changes'])
        # A merge only adds page content; reason and proof stay as they are.
        data = {'changes': changes}
        if not changes:
            if active_request is None:
                raise ValidationError(
                    {'changes': ['Chưa có thay đổi nào so với trang đang công khai.']}
                )
            _withdraw_emptied_request(active_request, requester)
            return None, False
    else:
        data = dict(data)
        data['changes'], base_values, staged_paths_to_delete = _replaced_changes(
            company, active_request, data['changes']
        )

    previous = None
    previous_status = None
    if active_request is not None:
        previous_status = active_request.status
        previous = {
            'changes': active_request.changes,
            'reason': active_request.reason,
            'proof_type': active_request.proof_type,
        }
    values = {
        **data,
        'company': company,
        'submitted_at': timezone.now(),
        'status': CompanyUpdateRequest.Status.SUBMITTED,
        'base_company_updated_at': company.updated_at,
        'base_values': base_values,
        'reviewed_by': None,
        'reviewed_at': None,
        'review_note': '',
    }
    if active_request is None:
        update_request = CompanyUpdateRequest.objects.create(requested_by=requester, **values)
    else:
        update_request = active_request
        for field, value in values.items():
            setattr(update_request, field, value)
        update_request.save()

    current = {
        'changes': update_request.changes,
        'reason': update_request.reason,
        'proof_type': update_request.proof_type,
    }
    if previous is not None and previous != current:
        update_request.documents.filter(is_current=True).update(
            status=CompanyDocument.Status.PENDING,
            reviewed_by=None,
            reviewed_at=None,
            review_note='',
        )
    if active_request is None:
        event_type = CompanyUpdateEvent.EventType.SUBMITTED
    elif previous_status == CompanyUpdateRequest.Status.CHANGES_REQUESTED:
        event_type = CompanyUpdateEvent.EventType.RESUBMITTED
    else:
        event_type = CompanyUpdateEvent.EventType.REVISION_CREATED
    snapshot_company_update_request(
        update_request,
        actor=requester,
        event_type=event_type,
        base_company_updated_at=company.updated_at,
        base_values=base_values,
    )
    if staged_paths_to_delete:

        def delete_discarded_media():
            for path in staged_paths_to_delete:
                delete_local_media_url(path)

        transaction.on_commit(delete_discarded_media)
    update_request.refresh_from_db()
    if update_request.is_sensitive:
        try:
            queue_company_tax_lookup(
                company=company,
                requested_by=requester,
                update_request=update_request,
                workflow_revision=update_request.revision,
                tax_code=update_request.changes.get('tax_code', company.tax_code),
                company_name=update_request.changes.get('company_name', company.company_name),
            )
        except ValueError:
            # The serializer rejects invalid new tax codes. This only
            # preserves manual review for malformed legacy company data.
            pass
    return update_request, active_request is None
