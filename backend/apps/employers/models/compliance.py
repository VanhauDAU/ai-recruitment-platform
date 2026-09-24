from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


class EmployerComplianceHold(models.Model):
    """Append-only source record for one recruiter compliance restriction.

    Resource links remain as audit evidence after release. Consumers only treat
    links whose parent hold is active as authoritative, which lets independent
    verification and DPA sources coexist without overwriting account or
    moderation holds stored by their owning domains.
    """

    class Source(models.TextChoices):
        VERIFICATION = 'verification', 'Xác thực nhà tuyển dụng'
        DPA = 'dpa', 'Thỏa thuận xử lý dữ liệu'

    class Reason(models.TextChoices):
        VERIFICATION_REVOKED = 'verification_revoked', 'Xác thực bị thu hồi'
        VERIFICATION_EXPIRED = 'verification_expired', 'Xác thực hết hiệu lực'
        DPA_OUTDATED = 'dpa_outdated', 'DPA không còn hiện hành'
        DPA_HOLD = 'dpa_hold', 'DPA quá hạn'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Đang áp dụng'
        RELEASED = 'released', 'Đã gỡ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        'employers.RecruiterProfile',
        on_delete=models.PROTECT,
        related_name='compliance_holds',
    )
    verification_case = models.ForeignKey(
        'employers.EmployerVerificationCase',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='compliance_holds',
    )
    source = models.CharField(max_length=24, choices=Source.choices)
    reason = models.CharField(max_length=40, choices=Reason.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    applied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )
    release_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['recruiter', 'status', 'source'],
                name='emp_hold_recruiter_idx',
            ),
            models.Index(
                fields=['status', 'source', 'reason'],
                name='emp_hold_source_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['recruiter', 'source'],
                condition=models.Q(status='active'),
                name='uniq_active_recruiter_hold_src',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status='active',
                        released_at__isnull=True,
                        released_by__isnull=True,
                        release_reason='',
                    )
                    | (
                        models.Q(
                            status='released',
                            released_at__isnull=False,
                            released_by__isnull=False,
                        )
                        & ~models.Q(release_reason='')
                    )
                ),
                name='emp_hold_release_state_consistent',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        source='verification',
                        verification_case__isnull=False,
                        reason__in=[
                            'verification_revoked',
                            'verification_expired',
                        ],
                    )
                    | models.Q(
                        source='dpa',
                        verification_case__isnull=True,
                        reason__in=['dpa_outdated', 'dpa_hold'],
                    )
                ),
                name='emp_hold_source_reason_valid',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ech')
        super().save(*args, **kwargs)


class EmployerComplianceHoldCampaign(models.Model):
    hold = models.ForeignKey(
        EmployerComplianceHold,
        on_delete=models.PROTECT,
        related_name='campaign_links',
    )
    campaign = models.ForeignKey(
        'employers.RecruitmentCampaign',
        on_delete=models.PROTECT,
        related_name='compliance_hold_links',
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['hold', 'campaign'],
                name='uniq_compliance_hold_campaign',
            ),
        ]
        indexes = [
            models.Index(fields=['campaign', 'hold'], name='emp_hold_campaign_idx'),
        ]


class EmployerComplianceHoldJob(models.Model):
    hold = models.ForeignKey(
        EmployerComplianceHold,
        on_delete=models.PROTECT,
        related_name='job_links',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.PROTECT,
        related_name='compliance_hold_links',
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['hold', 'job'],
                name='uniq_compliance_hold_job',
            ),
        ]
        indexes = [
            models.Index(fields=['job', 'hold'], name='emp_hold_job_idx'),
        ]
