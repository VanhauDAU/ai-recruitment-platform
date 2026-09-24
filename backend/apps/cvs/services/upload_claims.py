"""Candidate-domain attachment boundary for clean shared uploads."""

from contextlib import contextmanager

from django.core.files import File

from apps.uploads.models import UploadAsset
from apps.uploads.services import claim_clean_upload, release_claimed_upload
from common.r2_storage import private_media_storage

CANDIDATE_UPLOAD_PURPOSE = 'candidate_cv'
CV_SOURCE_CLAIM_SCOPE = 'candidate_cv_source'
CV_AVATAR_CLAIM_SCOPE = 'candidate_cv_avatar'
CV_SOURCE_RELEASE_REASON = 'candidate_cv_source_released'


def claim_candidate_upload(*, owner, session_public_id, claim_scope, claim_reference):
    return claim_clean_upload(
        owner=owner,
        public_id=session_public_id,
        expected_purpose=CANDIDATE_UPLOAD_PURPOSE,
        claim_scope=claim_scope,
        claim_reference=claim_reference,
    )


@contextmanager
def open_clean_candidate_upload(asset):
    """Open a scanner-approved private object with its original safe filename."""
    with private_media_storage().open(asset.storage_key, 'rb') as stored:
        yield File(stored, name=asset.original_filename)


def claimed_candidate_upload(*, claim_scope, claim_reference):
    return (
        UploadAsset.objects.select_related('source_session', 'owner')
        .filter(
            purpose=CANDIDATE_UPLOAD_PURPOSE,
            claim_scope=claim_scope,
            claim_reference=claim_reference,
            claimed_at__isnull=False,
        )
        .first()
    )


def release_candidate_cv_source(*, owner, cv_public_id):
    asset = claimed_candidate_upload(
        claim_scope=CV_SOURCE_CLAIM_SCOPE,
        claim_reference=cv_public_id,
    )
    if asset is None or asset.source_session is None:
        return None
    return release_claimed_upload(
        owner=owner,
        public_id=asset.source_session.public_id,
        expected_purpose=CANDIDATE_UPLOAD_PURPOSE,
        claim_scope=CV_SOURCE_CLAIM_SCOPE,
        claim_reference=cv_public_id,
        reason_code=CV_SOURCE_RELEASE_REASON,
    )
