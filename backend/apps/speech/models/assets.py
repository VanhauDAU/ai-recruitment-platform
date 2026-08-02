from django.db import models


class BlogSpeechAsset(models.Model):
    """Durable state for one requested, immutable narration artifact."""

    class Status(models.TextChoices):
        GENERATING = 'generating', 'Đang tạo'
        READY = 'ready', 'Sẵn sàng'
        FAILED = 'failed', 'Thất bại'

    post = models.ForeignKey(
        'blog.Post',
        on_delete=models.CASCADE,
        related_name='speech_assets',
    )
    post_revision = models.PositiveIntegerField()
    text_hash = models.CharField(max_length=64)
    artifact_key = models.CharField(max_length=64, db_index=True)
    config_hash = models.CharField(max_length=64)
    model_revision = models.CharField(max_length=100)
    voice_id = models.CharField(max_length=64)
    style = models.CharField(max_length=32)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.GENERATING)
    # Canonical durable object key. Production resolves this through R2;
    # development/tests use the existing local public-media storage backend.
    storage_key = models.TextField(blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveBigIntegerField(null=True, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finalize_lease_until = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['post', 'artifact_key'],
                name='uq_speech_post_artifact',
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', 'started_at'],
                name='speech_asset_recovery_idx',
            ),
        ]

    def __str__(self):
        return f'{self.post_id}:{self.post_revision}:{self.voice_id}:{self.style}'
