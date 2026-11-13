from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


class EmployerNotificationPreference(models.Model):
    """Optional email preferences; important verification decisions are immutable-on."""

    recipient = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employer_notification_preference',
    )
    intermediate_verification_email = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


class EmployerNotification(models.Model):
    """Recruiter-facing website notification persisted with the domain transaction."""

    class EventType(models.TextChoices):
        VERIFICATION_APPROVED = 'verification_approved', 'Hồ sơ xác thực đã được duyệt'
        VERIFICATION_CHANGES_REQUESTED = (
            'verification_changes_requested',
            'Hồ sơ xác thực cần bổ sung',
        )
        VERIFICATION_REJECTED = 'verification_rejected', 'Hồ sơ xác thực bị từ chối'
        VERIFICATION_REVOKED = 'verification_revoked', 'Xác thực đã bị thu hồi'
        VERIFICATION_EXPIRED = 'verification_expired', 'Xác thực đã hết hiệu lực'
        DOCUMENT_CHANGES_REQUESTED = (
            'document_changes_requested',
            'Giấy tờ xác thực cần bổ sung',
        )
        DOCUMENT_REJECTED = 'document_rejected', 'Giấy tờ xác thực bị từ chối'
        COMPANY_LINK_REMOVED = 'company_link_removed', 'Liên kết công ty đã được gỡ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employer_notifications',
    )
    event_type = models.CharField(max_length=48, choices=EventType.choices)
    dedupe_key = models.CharField(max_length=160)
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    action_path = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                name='uniq_employer_notice_recipient_dedupe',
            ),
        ]
        indexes = [
            models.Index(
                fields=['recipient', 'read_at', '-created_at'],
                name='emp_notice_unread_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('eno')
        super().save(*args, **kwargs)


class EmployerActivity(models.Model):
    """Privacy-safe recruiter activity retained independently from notification reads."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employer_activities',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=48, choices=EmployerNotification.EventType.choices)
    dedupe_key = models.CharField(max_length=160)
    summary = models.CharField(max_length=240)
    subject_public_id = models.CharField(max_length=50, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                name='uniq_employer_activity_recipient_dedupe',
            ),
        ]
        indexes = [
            models.Index(
                fields=['recipient', '-occurred_at'],
                name='emp_activity_user_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('eac')
        super().save(*args, **kwargs)
