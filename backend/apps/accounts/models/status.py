from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.public_id import generate_public_id


class AccountStatusTransition(models.Model):
    """Immutable evidence for one administrator-enforced account transition."""

    class Kind(models.TextChoices):
        SUSPEND = 'suspend', 'Temporarily suspend'
        BAN = 'ban', 'Ban'
        BEGIN_REACTIVATION = 'begin_reactivation', 'Begin reactivation review'
        REACTIVATE = 'reactivate', 'Reactivate'
        RELEASE_RESOURCE_HOLDS = 'release_resource_holds', 'Release resource holds'

    class EffectStatus(models.TextChoices):
        APPLIED = 'applied', 'Applied'
        FAILED = 'failed', 'Failed'

    class ViolationCategory(models.TextChoices):
        SECURITY = 'security', 'Security'
        FRAUD = 'fraud', 'Fraud'
        POLICY = 'policy', 'Policy'
        LEGAL = 'legal', 'Legal'
        OTHER = 'other', 'Other'

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='status_transitions',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='account_status_transitions_performed',
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    before_status = models.CharField(max_length=50)
    after_status = models.CharField(max_length=50)
    reason = models.TextField()
    enforcement_evidence = models.TextField(blank=True)
    violation_category = models.CharField(
        max_length=20,
        choices=ViolationCategory.choices,
        blank=True,
    )
    resource_snapshot = models.JSONField(default=dict, blank=True)
    effect_summary = models.JSONField(default=dict, blank=True)
    effect_status = models.CharField(
        max_length=20,
        choices=EffectStatus.choices,
        default=EffectStatus.APPLIED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['user', '-created_at'],
                name='acct_status_user_time_idx',
            ),
            models.Index(
                fields=['kind', '-created_at'],
                name='acct_status_kind_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('Account status transition records are immutable.')
        if not self.public_id:
            self.public_id = generate_public_id('ast')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Account status transition records cannot be deleted.')

    def __str__(self):
        return f'{self.user_id}:{self.kind}:{self.before_status}->{self.after_status}'
