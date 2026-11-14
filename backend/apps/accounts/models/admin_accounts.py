"""Audit log and invitations for administrator accounts."""

from django.db import models

from common.public_id import generate_public_id

from .user import User


class AdminAccessAuditLog(models.Model):
    public_id = models.CharField(max_length=64, unique=True, editable=False)
    actor = models.ForeignKey(
        User,
        related_name='admin_access_audit_logs',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    source = models.CharField(max_length=20)
    actor_identifier = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=32)
    target_public_id = models.CharField(max_length=64, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['created_at'], name='admin_audit_created_idx')]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('alog')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.action}:{self.target_type}:{self.target_public_id}'


class AdminInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REVOKED = 'revoked', 'Revoked'
        EXPIRED = 'expired', 'Expired'

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(
        User,
        related_name='admin_invitations_received',
        on_delete=models.PROTECT,
    )
    invited_by = models.ForeignKey(
        User,
        related_name='admin_invitations_sent',
        on_delete=models.PROTECT,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.CharField(max_length=500)
    token_version = models.PositiveIntegerField(default=1)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(status='pending'),
                name='uq_admin_invitation_pending_user',
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'expires_at'], name='admin_invite_status_exp_idx'),
            models.Index(fields=['invited_by', 'status'], name='admin_invite_actor_status_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ainv')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.email}:{self.status}'
