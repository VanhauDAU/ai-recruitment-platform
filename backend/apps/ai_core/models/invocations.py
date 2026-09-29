"""Privacy-minimized operational records for provider-neutral AI calls."""

from django.db import models
from django.utils import timezone


class AiInvocation(models.Model):
    """One provider invocation without storing its prompt or generated payload."""

    class Status(models.TextChoices):
        STARTED = 'started', 'Started'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED = 'failed', 'Failed'

    class ProviderBackend(models.TextChoices):
        GEMINI_DEVELOPER = 'gemini_developer', 'Gemini Developer API'
        VERTEX = 'vertex', 'Vertex AI'

    use_case = models.CharField(max_length=64)
    correlation_key = models.CharField(max_length=128, blank=True)
    provider = models.CharField(max_length=32)
    provider_backend = models.CharField(max_length=32, choices=ProviderBackend.choices)
    model = models.CharField(max_length=128)
    prompt_version = models.CharField(max_length=64)
    schema_version = models.CharField(max_length=64)
    prompt_sha256 = models.CharField(max_length=64)
    schema_sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.STARTED)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    retry_count = models.PositiveSmallIntegerField(default=0)
    input_tokens = models.PositiveBigIntegerField(default=0)
    output_tokens = models.PositiveBigIntegerField(default=0)
    total_tokens = models.PositiveBigIntegerField(default=0)
    cached_tokens = models.PositiveBigIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=16, decimal_places=8, default=0)
    latency_ms = models.PositiveBigIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    provider_request_id = models.CharField(max_length=255, blank=True)
    finish_reason = models.CharField(max_length=64, blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_invocations'
        indexes = [
            models.Index(fields=['-created_at'], name='ai_inv_created_idx'),
            models.Index(
                fields=['use_case', 'status', '-created_at'],
                name='ai_inv_use_status_idx',
            ),
            models.Index(
                fields=['correlation_key', '-created_at'],
                name='ai_inv_correlation_idx',
            ),
            models.Index(
                fields=['provider', 'model', '-created_at'],
                name='ai_inv_provider_idx',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(status='started', completed_at__isnull=True)
                    | ~models.Q(status='started') & models.Q(completed_at__isnull=False)
                ),
                name='ai_inv_completion_valid',
            ),
            models.CheckConstraint(
                condition=models.Q(attempt_count__gte=models.F('retry_count')),
                name='ai_inv_attempts_gte_retries',
            ),
        ]

    def __str__(self):
        return f'{self.use_case}:{self.provider}:{self.model}:{self.status}'


class AiUsageDaily(models.Model):
    """Durable, privacy-safe daily totals for one use-case/provider/model tuple."""

    date = models.DateField()
    use_case = models.CharField(max_length=64)
    provider = models.CharField(max_length=32)
    provider_backend = models.CharField(
        max_length=32,
        choices=AiInvocation.ProviderBackend.choices,
    )
    model = models.CharField(max_length=128)
    invocation_count = models.PositiveBigIntegerField(default=0)
    success_count = models.PositiveBigIntegerField(default=0)
    failure_count = models.PositiveBigIntegerField(default=0)
    quota_rejection_count = models.PositiveBigIntegerField(default=0)
    retry_count = models.PositiveBigIntegerField(default=0)
    input_tokens = models.PositiveBigIntegerField(default=0)
    output_tokens = models.PositiveBigIntegerField(default=0)
    total_tokens = models.PositiveBigIntegerField(default=0)
    cached_tokens = models.PositiveBigIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=18, decimal_places=8, default=0)
    total_latency_ms = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_usage_daily'
        ordering = ['-date', 'use_case', 'provider', 'model']
        constraints = [
            models.UniqueConstraint(
                fields=['date', 'use_case', 'provider', 'provider_backend', 'model'],
                name='ai_usage_daily_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['date', 'use_case'], name='ai_usage_date_use_idx'),
        ]

    def __str__(self):
        return f'{self.date}:{self.use_case}:{self.provider}:{self.model}'
