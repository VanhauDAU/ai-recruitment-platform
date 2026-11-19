from django.conf import settings
from django.db import models

from common.db.public_id import generate_public_id

from .documents import MatchDocument


class MatchAnalysis(models.Model):
    """Một lần phân tích độ phù hợp giữa một phiên bản CV và một tin tuyển dụng.

    Bộ (cv_version, job, job_content_hash, model_version, scoring_version) là khóa
    cache: trùng khóa thì dùng lại kết quả cũ. CV có phiên bản mới, tin đổi nội
    dung, hoặc đổi mô hình/công thức chấm thì khóa đổi và kết quả được tính lại.
    """

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Đang chờ'
        PROCESSING = 'processing', 'Đang xử lý'
        SUCCEEDED = 'succeeded', 'Hoàn tất'
        FAILED = 'failed', 'Thất bại'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='match_analyses',
    )
    cv_version = models.ForeignKey(
        'cvs.CvVersion',
        on_delete=models.CASCADE,
        related_name='match_analyses',
    )
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='match_analyses')
    job_content_hash = models.CharField(max_length=64)
    cv_document = models.ForeignKey(
        MatchDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    job_document = models.ForeignKey(
        MatchDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    overall_score = models.PositiveSmallIntegerField(null=True, blank=True)
    result_json = models.JSONField(default=dict, blank=True)
    model_version = models.CharField(max_length=64)
    scoring_version = models.CharField(max_length=32)
    error_code = models.CharField(max_length=80, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'cv_version',
                    'job',
                    'job_content_hash',
                    'model_version',
                    'scoring_version',
                ],
                name='uq_match_analysis_cache_key',
            ),
            models.CheckConstraint(
                condition=models.Q(overall_score__isnull=True) | models.Q(overall_score__lte=100),
                name='chk_match_analysis_score',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'job', '-created_at'], name='idx_match_analysis_user_job'),
        ]

    def __str__(self):
        return self.public_id

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ma')
        super().save(*args, **kwargs)
