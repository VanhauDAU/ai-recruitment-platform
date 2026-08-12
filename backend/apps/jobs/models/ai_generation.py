from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


def default_job_ai_manual_fields():
    """Fields deliberately kept outside every AI suggestion contract."""
    return [
        'salary_type',
        'salary_min',
        'salary_max',
        'income_display_type',
        'currency',
        'job_locations',
        'work_schedules',
        'work_schedule_note',
        'deadline',
        'number_of_vacancies',
        'campaign',
        'application_contact',
        'auto_reject_stale_applications',
        'auto_reject_after_days',
        'auto_rejection_email_body',
        'gender_requirement',
        'age_min',
        'age_max',
    ]


class JobAiGeneration(models.Model):
    """Durable, tenant-owned lifecycle for one AI-assisted job draft."""

    class Mode(models.TextChoices):
        AI_BRIEF = 'ai_brief', 'Brief có hướng dẫn'
        JD_TEXT = 'jd_text', 'JD có sẵn'

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Đang chờ'
        PROCESSING = 'processing', 'Đang xử lý'
        COMPLETED = 'completed', 'Hoàn tất'
        FAILED = 'failed', 'Thất bại'
        CANCELLED = 'cancelled', 'Đã hủy'

    class Phase(models.TextChoices):
        QUEUED = 'queued', 'Đang chờ'
        PREPARING_CONTEXT = 'preparing_context', 'Chuẩn bị dữ liệu'
        GENERATING = 'generating', 'Đang tạo nội dung'
        VALIDATING = 'validating', 'Đang kiểm tra'
        COMPLETED = 'completed', 'Hoàn tất'
        FAILED = 'failed', 'Thất bại'
        CANCELLED = 'cancelled', 'Đã hủy'

    class Feedback(models.TextChoices):
        HELPFUL = 'helpful', 'Hữu ích'
        NOT_HELPFUL = 'not_helpful', 'Chưa hữu ích'

    class FeedbackReason(models.TextChoices):
        ACCURACY = 'accuracy', 'Độ chính xác'
        RELEVANCE = 'relevance', 'Độ liên quan'
        WRITING_QUALITY = 'writing_quality', 'Chất lượng diễn đạt'
        TAXONOMY = 'taxonomy', 'Danh mục/kỹ năng'
        OTHER = 'other', 'Khác'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_ai_generations',
    )
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        related_name='job_ai_generations',
    )
    applied_job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_generations',
    )
    mode = models.CharField(max_length=20, choices=Mode.choices)
    locale = models.CharField(max_length=16, default='vi-VN')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    phase = models.CharField(max_length=32, choices=Phase.choices, default=Phase.QUEUED)
    sanitized_input = models.JSONField(default=dict)
    result = models.JSONField(default=dict, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    unresolved_suggestions = models.JSONField(default=dict, blank=True)
    manual_fields = models.JSONField(default=default_job_ai_manual_fields)
    idempotency_key = models.CharField(max_length=64)
    request_hash = models.CharField(max_length=64, editable=False)
    quota_day = models.DateField()
    model = models.CharField(max_length=120, blank=True)
    prompt_version = models.CharField(max_length=32, default='job-post-v2')
    schema_version = models.CharField(max_length=32, default='job-post-v2')
    provider_attempts = models.PositiveSmallIntegerField(default=0)
    invocation_id = models.BigIntegerField(null=True, blank=True)
    error_code = models.CharField(max_length=80, blank=True)
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    applied_diff = models.JSONField(default=dict, blank=True)
    feedback = models.CharField(max_length=20, choices=Feedback.choices, blank=True)
    feedback_reason = models.CharField(
        max_length=32,
        choices=FeedbackReason.choices,
        blank=True,
    )
    feedback_at = models.DateTimeField(null=True, blank=True)
    content_purged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'idempotency_key'],
                name='uq_job_ai_generation_owner_idempotency',
            ),
        ]
        indexes = [
            models.Index(
                fields=['owner', 'quota_day'],
                name='jobs_ai_owner_quota_idx',
            ),
            models.Index(
                fields=['status', 'lease_expires_at'],
                name='jobs_ai_status_lease_idx',
            ),
            models.Index(
                fields=['created_at', 'content_purged_at'],
                name='jobs_ai_retention_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jaig')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.public_id}:{self.status}'
