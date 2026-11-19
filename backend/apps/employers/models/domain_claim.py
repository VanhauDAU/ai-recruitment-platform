from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id

from .company import Company


class AppendOnlyDomainEventQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValueError('CompanyDomainClaimEvent is append-only.')

    def delete(self):
        raise ValueError('CompanyDomainClaimEvent is append-only.')


class CompanyDomainClaim(models.Model):
    """Proof that a company controls one exact e-mail domain.

    A claim belongs to the company, while ``requested_by`` records the
    recruiter who initiated the proof.  The public badge must still validate
    each recruiter's current, verified e-mail against this exact domain.
    """

    class Method(models.TextChoices):
        DNS_TXT = 'dns_txt', 'DNS TXT'
        ADMIN_MANUAL = 'admin_manual', gettext_lazy('Quản trị duyệt thủ công')
        LEGACY_INFERRED = 'legacy_inferred', gettext_lazy('Suy luận từ dữ liệu cũ')

    class Status(models.TextChoices):
        PENDING = 'pending', gettext_lazy('Chờ xác minh')
        VERIFIED = 'verified', gettext_lazy('Đã xác minh')
        GRACE = 'grace', gettext_lazy('Thời gian gia hạn')
        REJECTED = 'rejected', gettext_lazy('Bị từ chối')
        REVOKED = 'revoked', gettext_lazy('Đã thu hồi')
        EXPIRED = 'expired', gettext_lazy('Hết hiệu lực')
        LEGACY_INFERRED = 'legacy_inferred', gettext_lazy('Chưa xác minh (dữ liệu cũ)')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='domain_claims',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='company_domain_claims_requested',
    )
    domain = models.CharField(max_length=253)
    method = models.CharField(max_length=24, choices=Method.choices, default=Method.DNS_TXT)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    token_hash = models.CharField(max_length=64, blank=True)
    challenge_expires_at = models.DateTimeField(null=True, blank=True)
    manual_review_requested_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    next_check_at = models.DateTimeField(null=True, blank=True)
    grace_expires_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='company_domain_claims_reviewed',
    )
    review_reason = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=1)
    lock_version = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'domain'],
                name='uniq_company_domain_claim',
            ),
            models.UniqueConstraint(
                fields=['domain'],
                condition=models.Q(status__in=['verified', 'grace']),
                name='uniq_active_verified_company_domain',
            ),
        ]
        indexes = [
            models.Index(
                fields=['company', 'status'],
                name='emp_domain_company_status_idx',
            ),
            models.Index(
                fields=['status', 'next_check_at'],
                name='emp_domain_recheck_idx',
            ),
        ]

    def __str__(self):
        return f'{self.company_id}:{self.domain}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('dcl')
        super().save(*args, **kwargs)


class CompanyDomainClaimEvent(models.Model):
    """Append-only security/audit timeline for a company domain claim."""

    class EventType(models.TextChoices):
        CHALLENGE_CREATED = 'challenge_created', gettext_lazy('Đã tạo challenge')
        CHALLENGE_ROTATED = 'challenge_rotated', gettext_lazy('Đã đổi challenge')
        DNS_CHECK_PASSED = 'dns_check_passed', gettext_lazy('DNS hợp lệ')
        DNS_CHECK_FAILED = 'dns_check_failed', gettext_lazy('DNS chưa hợp lệ')
        MANUAL_REVIEW_REQUESTED = (
            'manual_review_requested',
            gettext_lazy('Đã yêu cầu duyệt thủ công'),
        )
        MANUAL_APPROVED = 'manual_approved', gettext_lazy('Đã duyệt thủ công')
        MANUAL_REJECTED = 'manual_rejected', gettext_lazy('Đã từ chối thủ công')
        GRACE_STARTED = 'grace_started', gettext_lazy('Bắt đầu thời gian gia hạn')
        REVERIFIED = 'reverified', gettext_lazy('Đã xác minh lại')
        REVOKED = 'revoked', gettext_lazy('Đã thu hồi')
        EXPIRED = 'expired', gettext_lazy('Đã hết hiệu lực')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    claim = models.ForeignKey(
        CompanyDomainClaim,
        on_delete=models.PROTECT,
        related_name='events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    objects = AppendOnlyDomainEventQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['claim', '-created_at'],
                name='emp_domain_event_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError('CompanyDomainClaimEvent is append-only.')
        if not self.public_id:
            self.public_id = generate_public_id('dce')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('CompanyDomainClaimEvent is append-only.')
