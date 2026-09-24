from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.public_id import generate_public_id


class PhoneOtp(models.Model):
    """Phone-verification challenge with a legacy email compatibility path.

    New SMS challenges never persist a plaintext destination or OTP. The
    encrypted fields only bridge transaction commit to the asynchronous SMS
    worker and are removed by the retention job. ``phone`` remains solely for
    challenges created by the live legacy-email endpoints during cutover.
    """

    class Purpose(models.TextChoices):
        LEGACY_EMAIL = 'legacy_email', 'Legacy email compatibility'
        INITIAL_VERIFICATION = 'initial_verification', 'Initial verification'
        PHONE_CHANGE = 'phone_change', 'Phone change'
        REVERIFY = 'reverify', 'Self-service re-verification'

    class DispatchStatus(models.TextChoices):
        LEGACY_EMAIL = 'legacy_email', 'Legacy email compatibility'
        QUEUED = 'queued', 'Queued'
        DISPATCHING = 'dispatching', 'Dispatching'
        RETRY_PENDING = 'retry_pending', 'Retry pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        DISABLED = 'disabled', 'Provider disabled'
        VERIFIED = 'verified', 'Verified'
        PURGED = 'purged', 'Sensitive payload purged'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='phone_otps'
    )
    purpose = models.CharField(
        max_length=32,
        choices=Purpose.choices,
        default=Purpose.LEGACY_EMAIL,
    )
    dispatch_status = models.CharField(
        max_length=24,
        choices=DispatchStatus.choices,
        default=DispatchStatus.LEGACY_EMAIL,
    )
    # Legacy-only plaintext field. New SMS challenges keep this empty.
    phone = models.CharField(max_length=20, blank=True)
    phone_fingerprint = models.CharField(max_length=64, blank=True, db_index=True)
    destination_ciphertext = models.TextField(blank=True)
    otp_ciphertext = models.TextField(blank=True)
    code_hash = models.CharField(max_length=128, blank=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    dispatch_attempts = models.PositiveSmallIntegerField(default=0)
    dispatch_started_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    provider_message_id = models.CharField(max_length=255, blank=True)
    dispatch_error_code = models.CharField(max_length=50, blank=True)
    invalidated_at = models.DateTimeField(null=True, blank=True)
    invalidation_reason = models.CharField(max_length=50, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    secret_purged_at = models.DateTimeField(null=True, blank=True)
    pii_purged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', '-created_at'], name='phone_otp_user_created_idx'),
            models.Index(
                fields=['dispatch_status', 'dispatch_started_at'],
                name='phone_otp_dispatch_idx',
            ),
            models.Index(fields=['created_at', 'pii_purged_at'], name='phone_otp_purge_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('poc')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.public_id}:{self.purpose}:{self.dispatch_status}'


class EmployerPhoneVerificationEvent(models.Model):
    """Append-only, phone/OTP-free security evidence retained for 24 months."""

    class EventType(models.TextChoices):
        CHALLENGE_CREATED = 'challenge_created', 'Challenge created'
        CHALLENGE_INVALIDATED = 'challenge_invalidated', 'Challenge invalidated'
        LEGACY_INVALIDATED = 'legacy_invalidated', 'Legacy challenge invalidated'
        DISPATCH_STARTED = 'dispatch_started', 'Dispatch started'
        DISPATCH_SENT = 'dispatch_sent', 'Dispatch sent'
        DISPATCH_RETRY = 'dispatch_retry', 'Dispatch retry scheduled'
        DISPATCH_FAILED = 'dispatch_failed', 'Dispatch failed'
        DISPATCH_DISABLED = 'dispatch_disabled', 'Dispatch disabled'
        STALE_RECOVERED = 'stale_recovered', 'Stale dispatch recovered'
        VERIFIED = 'verified', 'Phone verified'
        PAYLOAD_PURGED = 'payload_purged', 'Sensitive payload purged'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employer_phone_verification_events',
    )
    challenge_public_id = models.CharField(max_length=50, blank=True, db_index=True)
    purpose = models.CharField(max_length=32, choices=PhoneOtp.Purpose.choices)
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    outcome = models.CharField(max_length=24, blank=True)
    reason_code = models.CharField(max_length=50, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-occurred_at', '-pk']
        indexes = [
            models.Index(fields=['user', '-occurred_at'], name='phone_event_user_time_idx'),
        ]

    def save(self, *args, **kwargs):
        if self.pk and not self._state.adding:
            raise ValidationError('Employer phone verification events are append-only.')
        if not self.public_id:
            self.public_id = generate_public_id('pve')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'
