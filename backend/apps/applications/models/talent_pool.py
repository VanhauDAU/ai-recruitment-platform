from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.db.public_id import generate_public_id

RETENTION = timedelta(days=365)


def _default_expiry():
    return timezone.now() + RETENTION


class TalentPoolEntry(models.Model):
    """A candidate a recruiter keeps for future openings.

    The candidate is told when saved and may withdraw at any time; entries
    lapse after 12 months so personal data is not kept indefinitely.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='talent_pool_entries'
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='talent_pool_memberships'
    )
    # The application the candidate was saved from: the job it targeted is
    # what new openings are matched against.
    source_application = models.ForeignKey(
        'applications.Application', on_delete=models.SET_NULL, null=True, related_name='+'
    )
    note = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_expiry)
    removed_at = models.DateTimeField(null=True, blank=True)  # by the recruiter
    withdrawn_at = models.DateTimeField(null=True, blank=True)  # by the candidate

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['recruiter', 'candidate'],
                condition=Q(removed_at__isnull=True, withdrawn_at__isnull=True),
                name='uniq_open_talent_pool_entry',
            ),
        ]
        indexes = [
            models.Index(fields=['recruiter', '-created_at'], name='talent_pool_recruiter_idx')
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tpe')
        super().save(*args, **kwargs)

    @classmethod
    def active_q(cls, prefix=''):
        return Q(
            **{
                f'{prefix}removed_at__isnull': True,
                f'{prefix}withdrawn_at__isnull': True,
                f'{prefix}expires_at__gt': timezone.now(),
            }
        )


class TalentPoolInvitation(models.Model):
    """One invitation to apply, so a candidate is never invited twice to a job."""

    entry = models.ForeignKey(TalentPoolEntry, on_delete=models.CASCADE, related_name='invitations')
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='+')
    invited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['entry', 'job'], name='uniq_talent_pool_invitation'),
        ]
