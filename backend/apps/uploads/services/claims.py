"""Domain attach/release of clean assets and retention legal holds."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.uploads.models import (
    UploadAsset,
    UploadSession,
    UploadState,
)

from .errors import upload_error
from .retention import retention_deadline
from .validation import normalise_purpose, validate_reference


def claim_clean_upload(
    *,
    owner,
    public_id,
    expected_purpose,
    claim_scope,
    claim_reference,
):
    """Explicitly attach a clean upload; repeated identical claims are idempotent."""
    expected_purpose = normalise_purpose(expected_purpose)
    claim_scope = validate_reference(claim_scope)
    claim_reference = validate_reference(claim_reference)
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.purpose != expected_purpose:
            raise upload_error('UPLOAD_PURPOSE_MISMATCH')
        if session.state != UploadState.CLEAN or session.expires_at <= now:
            raise upload_error('UPLOAD_NOT_CLEAN')
        asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
        if asset is None or asset.deleted_at is not None or not asset.storage_key:
            raise upload_error('UPLOAD_NOT_CLEAN')
        if asset.claimed_at:
            if asset.claim_scope == claim_scope and asset.claim_reference == claim_reference:
                return asset
            raise upload_error('UPLOAD_ALREADY_SUBMITTED')
        retained_until = max(asset.retained_until, retention_deadline(now))
        asset.claimed_at = now
        asset.claim_scope = claim_scope
        asset.claim_reference = claim_reference
        asset.retained_until = retained_until
        asset.save(
            update_fields=[
                'claimed_at',
                'claim_scope',
                'claim_reference',
                'retained_until',
                'updated_at',
            ]
        )
        session.expires_at = retained_until
        session.save(update_fields=['expires_at', 'updated_at'])
        return asset


def release_claimed_upload(
    *,
    owner,
    public_id,
    expected_purpose,
    claim_scope,
    claim_reference,
    reason_code,
):
    """Release a domain reference without shortening the approved retention window."""
    expected_purpose = normalise_purpose(expected_purpose)
    claim_scope = validate_reference(claim_scope)
    claim_reference = validate_reference(claim_reference)
    reason_code = validate_reference(reason_code)
    now = timezone.now()
    with transaction.atomic():
        session = (
            UploadSession.objects.select_for_update()
            .filter(public_id=public_id, owner=owner)
            .first()
        )
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        if session.purpose != expected_purpose:
            raise upload_error('UPLOAD_PURPOSE_MISMATCH')
        asset = UploadAsset.objects.select_for_update().filter(source_session=session).first()
        if (
            asset is None
            or asset.claimed_at is None
            or asset.claim_scope != claim_scope
            or asset.claim_reference != claim_reference
        ):
            raise upload_error('RESOURCE_NOT_FOUND')
        if asset.released_at:
            if asset.release_reason_code == reason_code:
                return asset
            raise upload_error('UPLOAD_INVALID_STATE')
        asset.released_at = now
        asset.release_reason_code = reason_code
        asset.save(update_fields=['released_at', 'release_reason_code', 'updated_at'])
        return asset


def place_upload_legal_hold(*, asset_public_id, reason_code):
    """Internal retention primitive; domain code remains responsible for admin audit."""
    reason_code = validate_reference(reason_code)
    now = timezone.now()
    source_session_id = (
        UploadAsset.objects.filter(public_id=asset_public_id)
        .values_list('source_session_id', flat=True)
        .first()
    )
    with transaction.atomic():
        session = None
        if source_session_id:
            session = UploadSession.objects.select_for_update().filter(pk=source_session_id).first()
        asset = UploadAsset.objects.select_for_update().filter(public_id=asset_public_id).first()
        if asset is None or asset.deleted_at is not None:
            raise upload_error('RESOURCE_NOT_FOUND')
        asset.legal_hold_at = asset.legal_hold_at or now
        asset.legal_hold_reason_code = reason_code
        asset.save(update_fields=['legal_hold_at', 'legal_hold_reason_code', 'updated_at'])
        if session is not None and asset.source_session_id == session.pk:
            UploadSession.objects.filter(pk=session.pk).update(
                legal_hold_at=asset.legal_hold_at,
                legal_hold_reason_code=reason_code,
                updated_at=now,
            )
        return asset
