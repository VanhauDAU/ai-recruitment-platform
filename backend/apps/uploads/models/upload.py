import uuid

from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from .state import UploadScanAttemptStatus, UploadState, UploadTrustStatus


class UploadSession(models.Model):
    """Owner-scoped temporary upload whose bytes remain untrusted until scanned."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='upload_sessions',
    )
    purpose = models.CharField(max_length=64)
    original_filename = models.CharField(max_length=255)
    declared_content_type = models.CharField(max_length=127)
    detected_content_type = models.CharField(max_length=127, blank=True)
    expected_size_bytes = models.PositiveBigIntegerField()
    size_bytes = models.PositiveBigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    state = models.CharField(
        max_length=20,
        choices=UploadState.choices,
        default=UploadState.UPLOADING,
    )
    terminal_reason = models.CharField(max_length=64, blank=True)
    quarantine_storage_key = models.TextField(blank=True)
    upload_lease_token = models.UUIDField(null=True, blank=True, editable=False)
    upload_lease_until = models.DateTimeField(null=True, blank=True)
    scan_attempts = models.PositiveSmallIntegerField(default=0)
    scan_lease_token = models.UUIDField(null=True, blank=True, editable=False)
    scan_lease_until = models.DateTimeField(null=True, blank=True)
    next_scan_at = models.DateTimeField(null=True, blank=True)
    scan_result_code = models.CharField(max_length=64, blank=True)
    threat_signature_sha256 = models.CharField(max_length=64, blank=True)
    scan_started_at = models.DateTimeField(null=True, blank=True)
    scan_completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    evidence_retained_until = models.DateTimeField()
    cancelled_at = models.DateTimeField(null=True, blank=True)
    quarantine_deleted_at = models.DateTimeField(null=True, blank=True)
    legal_hold_at = models.DateTimeField(null=True, blank=True)
    legal_hold_reason_code = models.CharField(max_length=64, blank=True)
    lock_version = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'upload_sessions'
        indexes = [
            models.Index(fields=['owner', '-created_at'], name='upl_session_owner_idx'),
            models.Index(fields=['state', 'next_scan_at'], name='upl_session_scan_idx'),
            models.Index(fields=['state', 'expires_at'], name='upl_session_expiry_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(expected_size_bytes__gt=0),
                name='upl_session_expected_size_gt0',
            ),
            models.CheckConstraint(
                condition=models.Q(size_bytes__gte=0),
                name='upl_session_size_gte0',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(legal_hold_at__isnull=True, legal_hold_reason_code='')
                    | models.Q(legal_hold_at__isnull=False) & ~models.Q(legal_hold_reason_code='')
                ),
                name='upl_session_hold_complete',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ups')
        super().save(*args, **kwargs)


class UploadAsset(models.Model):
    """Private durable object that a business aggregate may explicitly claim."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='upload_assets',
    )
    source_session = models.OneToOneField(
        UploadSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset',
    )
    trust_status = models.CharField(max_length=24, choices=UploadTrustStatus.choices)
    purpose = models.CharField(max_length=64)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=127)
    size_bytes = models.PositiveBigIntegerField()
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    storage_key = models.TextField()
    claimed_at = models.DateTimeField(null=True, blank=True)
    claim_scope = models.CharField(max_length=64, blank=True)
    claim_reference = models.CharField(max_length=64, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    release_reason_code = models.CharField(max_length=64, blank=True)
    retained_until = models.DateTimeField()
    legal_hold_at = models.DateTimeField(null=True, blank=True)
    legal_hold_reason_code = models.CharField(max_length=64, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'upload_assets'
        indexes = [
            models.Index(fields=['owner', '-created_at'], name='upl_asset_owner_idx'),
            models.Index(fields=['retained_until'], name='upl_asset_retention_idx'),
            models.Index(fields=['claim_scope', 'claim_reference'], name='upl_asset_claim_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(size_bytes__gt=0) | models.Q(deleted_at__isnull=False, size_bytes=0)
                ),
                name='upl_asset_size_or_deleted',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(claimed_at__isnull=True, claim_scope='', claim_reference='')
                    | models.Q(claimed_at__isnull=False)
                    & ~models.Q(claim_scope='')
                    & ~models.Q(claim_reference='')
                ),
                name='upl_asset_claim_complete',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(released_at__isnull=True, release_reason_code='')
                    | models.Q(released_at__isnull=False, claimed_at__isnull=False)
                    & ~models.Q(release_reason_code='')
                ),
                name='upl_asset_release_complete',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(legal_hold_at__isnull=True, legal_hold_reason_code='')
                    | models.Q(legal_hold_at__isnull=False) & ~models.Q(legal_hold_reason_code='')
                ),
                name='upl_asset_hold_complete',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(trust_status=UploadTrustStatus.LEGACY_TRUSTED)
                    | models.Q(deleted_at__isnull=False)
                    | ~models.Q(checksum_sha256='')
                ),
                name='upl_clean_asset_has_checksum',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('upa')
        super().save(*args, **kwargs)


class UploadScanAttempt(models.Model):
    """Privacy-minimized evidence for one scanner attempt."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    session = models.ForeignKey(
        UploadSession,
        on_delete=models.CASCADE,
        related_name='scan_attempt_records',
    )
    attempt_number = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=20,
        choices=UploadScanAttemptStatus.choices,
        default=UploadScanAttemptStatus.RUNNING,
    )
    result_code = models.CharField(max_length=64, blank=True)
    threat_signature_sha256 = models.CharField(max_length=64, blank=True)
    scanner_revision_sha256 = models.CharField(max_length=64, blank=True)
    lease_token = models.UUIDField(default=uuid.uuid4, editable=False)
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'upload_scan_attempts'
        ordering = ['attempt_number']
        constraints = [
            models.UniqueConstraint(
                fields=['session', 'attempt_number'],
                name='upl_scan_attempt_unique',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status=UploadScanAttemptStatus.RUNNING, completed_at__isnull=True)
                    | ~models.Q(status=UploadScanAttemptStatus.RUNNING)
                    & models.Q(completed_at__isnull=False)
                ),
                name='upl_scan_completion_valid',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('usc')
        super().save(*args, **kwargs)
