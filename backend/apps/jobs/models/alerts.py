from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from .core import Job, JobCategory


class JobAlert(models.Model):
    """A candidate-owned, deterministic subscription to newly published jobs."""

    class KeywordScope(models.TextChoices):
        TITLE = 'title', 'Tên việc làm'
        COMPANY = 'company', 'Tên công ty'
        BOTH = 'both', 'Tên việc làm hoặc công ty'

    class SalaryBucket(models.TextChoices):
        UNDER_10 = 'u10', 'Dưới 10 triệu'
        FROM_10_TO_15 = '10-15', '10 - 15 triệu'
        FROM_15_TO_20 = '15-20', '15 - 20 triệu'
        FROM_20_TO_25 = '20-25', '20 - 25 triệu'
        FROM_25_TO_30 = '25-30', '25 - 30 triệu'
        FROM_30_TO_50 = '30-50', '30 - 50 triệu'
        OVER_50 = 'o50', 'Trên 50 triệu'

    class Frequency(models.TextChoices):
        DAILY = 'daily', 'Hằng ngày'
        WEEKLY = 'weekly', 'Hằng tuần'

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_alerts',
    )
    public_id = models.CharField(max_length=50, unique=True, editable=False)
    keyword = models.CharField(max_length=255)
    keyword_scope = models.CharField(
        max_length=16,
        choices=KeywordScope.choices,
        default=KeywordScope.TITLE,
    )
    categories = models.ManyToManyField(
        JobCategory,
        through='JobAlertCategory',
        related_name='candidate_job_alerts',
        blank=True,
    )
    province = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )
    ward = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
    )
    salary_bucket = models.CharField(
        max_length=16,
        choices=SalaryBucket.choices,
        blank=True,
    )
    experience_years = models.CharField(
        max_length=20,
        choices=Job.ExperienceYears.choices,
        blank=True,
    )
    work_type = models.CharField(
        max_length=50,
        choices=Job.WorkType.choices,
        blank=True,
    )
    employment_type = models.CharField(
        max_length=50,
        choices=Job.EmploymentType.choices,
        blank=True,
    )
    frequency = models.CharField(
        max_length=16,
        choices=Frequency.choices,
        default=Frequency.DAILY,
    )
    is_active = models.BooleanField(default=True)
    criteria_fingerprint = models.CharField(max_length=64)
    cursor_at = models.DateTimeField()
    next_run_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'criteria_fingerprint'],
                name='uq_job_alert_candidate_fingerprint',
            ),
        ]
        indexes = [
            models.Index(
                fields=['candidate', '-created_at'],
                name='job_alert_candidate_time_idx',
            ),
            models.Index(
                fields=['is_active', 'next_run_at'],
                name='job_alert_due_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jal')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.candidate_id}:{self.keyword}'


class JobAlertCategory(models.Model):
    """An explicitly selected taxonomy node for a configured job alert."""

    alert = models.ForeignKey(
        JobAlert,
        on_delete=models.CASCADE,
        related_name='category_links',
    )
    category = models.ForeignKey(
        JobCategory,
        on_delete=models.PROTECT,
        related_name='candidate_job_alert_links',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['alert', 'category'],
                name='uq_job_alert_category',
            ),
        ]


class CandidateJobDigestSchedule(models.Model):
    """Cursor and cadence for the separate profile/CV recommendation digest."""

    candidate = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_digest_schedule',
    )
    suitable_cursor_at = models.DateTimeField()
    suitable_next_run_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['suitable_next_run_at'],
                name='job_digest_suitable_due_idx',
            ),
        ]


class CandidateJobDigest(models.Model):
    """Persisted, retryable email outbox consolidating all due candidate sources."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ gửi'
        SENDING = 'sending', 'Đang gửi'
        SENT = 'sent', 'Đã gửi'
        EMPTY = 'empty', 'Không có việc làm mới'
        SKIPPED = 'skipped', 'Bỏ qua theo cài đặt'
        FAILED = 'failed', 'Gửi thất bại'
        CANCELLED = 'cancelled', 'Đã hủy'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    message_id = models.CharField(max_length=255, unique=True, editable=False)
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_alert_digests',
    )
    scheduled_for = models.DateTimeField()
    source_alert_public_ids = models.JSONField(default=list, blank=True)
    includes_suitable_recommendations = models.BooleanField(default=False)
    source_windows = models.JSONField(default=dict, blank=True)
    recipient_email = models.EmailField()
    recipient_auth_revision = models.PositiveBigIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    job_count = models.PositiveSmallIntegerField(default=0)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'scheduled_for'],
                name='uq_job_digest_candidate_schedule',
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', 'created_at'],
                name='job_digest_status_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jdi')
        if not self.message_id:
            self.message_id = f'<job-alert.{self.public_id}@procv.vn>'
        super().save(*args, **kwargs)


class CandidateJobDigestItem(models.Model):
    """One publication claimed for a candidate across strict and suitable flows."""

    class SourceKind(models.TextChoices):
        CONFIGURED_ALERT = 'configured_alert', 'Thông báo đã cài đặt'
        SUITABLE_RECOMMENDATION = 'suitable_recommendation', 'Việc làm phù hợp'

    digest = models.ForeignKey(
        CandidateJobDigest,
        on_delete=models.CASCADE,
        related_name='items',
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='+')
    source_kind = models.CharField(max_length=32, choices=SourceKind.choices)
    source_alert = models.ForeignKey(
        JobAlert,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digest_items',
    )
    source_alert_public_ids = models.JSONField(default=list, blank=True)
    source_alert_fingerprints = models.JSONField(default=dict, blank=True)
    includes_suitable_recommendation = models.BooleanField(default=False)
    job_published_at = models.DateTimeField()
    sort_order = models.PositiveSmallIntegerField(default=0)
    match_score = models.PositiveSmallIntegerField(null=True, blank=True)
    match_reasons = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['digest', 'job'],
                name='uq_job_digest_item_job',
            ),
        ]
        indexes = [
            models.Index(
                fields=['candidate', 'job'],
                name='jdi_candidate_job_idx',
            ),
        ]


class CandidateJobEmailReceipt(models.Model):
    """Ninety-day successful-delivery audit linked to the originating digest."""

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='+')
    job_published_at = models.DateTimeField()
    digest = models.ForeignKey(
        CandidateJobDigest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='receipts',
    )
    sent_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'job'],
                name='uq_candidate_job_email_receipt',
            ),
        ]
        indexes = [
            models.Index(
                fields=['candidate', 'job'],
                name='job_email_receipt_lookup_idx',
            ),
        ]


class CandidateJobEmailSuppression(models.Model):
    """Minimal permanent ledger preventing a job from ever being emailed twice."""

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='+')
    first_sent_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'job'],
                name='uq_candidate_job_email_suppression',
            ),
        ]
