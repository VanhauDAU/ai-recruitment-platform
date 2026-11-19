"""Pure lifecycle-state invariants for the shared upload pipeline."""

from django.db import models


class UploadState(models.TextChoices):
    UPLOADING = 'uploading', 'Uploading'
    QUARANTINED = 'quarantined', 'Quarantined'
    SCANNING = 'scanning', 'Scanning'
    CLEAN = 'clean', 'Clean'
    REJECTED = 'rejected', 'Rejected'
    ERROR = 'error', 'Error'
    EXPIRED = 'expired', 'Expired'


class UploadScanAttemptStatus(models.TextChoices):
    RUNNING = 'running', 'Running'
    CLEAN = 'clean', 'Clean'
    MALICIOUS = 'malicious', 'Malicious'
    ERROR = 'error', 'Error'


class UploadStateError(ValueError):
    """Raised when a caller attempts an impossible lifecycle transition."""


ALLOWED_UPLOAD_TRANSITIONS = {
    UploadState.UPLOADING: frozenset({UploadState.QUARANTINED, UploadState.EXPIRED}),
    UploadState.QUARANTINED: frozenset({UploadState.SCANNING, UploadState.EXPIRED}),
    UploadState.SCANNING: frozenset(
        {
            UploadState.CLEAN,
            UploadState.REJECTED,
            UploadState.ERROR,
            UploadState.EXPIRED,
        }
    ),
    UploadState.ERROR: frozenset({UploadState.SCANNING, UploadState.EXPIRED}),
    UploadState.CLEAN: frozenset({UploadState.EXPIRED}),
    UploadState.REJECTED: frozenset({UploadState.EXPIRED}),
    UploadState.EXPIRED: frozenset(),
}


def ensure_upload_transition(current: str, target: str) -> None:
    """Validate a state change without performing database or storage I/O."""
    if target == current:
        return
    if target not in ALLOWED_UPLOAD_TRANSITIONS.get(current, frozenset()):
        raise UploadStateError(f'Invalid upload transition: {current} -> {target}.')
