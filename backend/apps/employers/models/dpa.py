"""Immutable evidence for employer/platform DPA acceptances."""

from django.db import models

from common.public_id import generate_public_id


class EmployerDpaAcceptance(models.Model):
    """An append-only proof that a recruiter accepted one exact DPA document.

    Legacy ``RecruiterProfile.dpa_accepted_at`` values intentionally do not get
    fabricated rows during migration. They remain distinguishable as
    ``legacy_unversioned`` until the recruiter accepts the current document.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        'employers.RecruiterProfile',
        on_delete=models.PROTECT,
        related_name='dpa_acceptances',
    )
    policy_version = models.CharField(max_length=64)
    document_sha256 = models.CharField(max_length=64)
    document_url = models.URLField(max_length=500)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    auth_session = models.ForeignKey(
        'accounts.AuthSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employer_dpa_acceptances',
    )
    user_agent_hash = models.CharField(max_length=64, blank=True)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-accepted_at', '-id']
        indexes = [
            models.Index(
                fields=['recruiter', '-accepted_at'],
                name='employer_dpa_rec_accepted_idx',
            ),
            models.Index(
                fields=['policy_version', 'document_sha256'],
                name='employer_dpa_policy_hash_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['recruiter', 'policy_version', 'document_sha256'],
                name='uniq_employer_dpa_exact_acceptance',
            ),
            models.CheckConstraint(
                condition=models.Q(document_sha256__regex=r'^[0-9a-f]{64}$'),
                name='employer_dpa_sha256_lower_hex',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('dpa')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.recruiter_id}:{self.policy_version}:{self.public_id}'
