from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


class JobModerationEvent(models.Model):
    """Immutable evidence for administrator decisions about one job revision."""

    class Action(models.TextChoices):
        APPROVE = 'approve', 'Duyệt tin'
        REJECT = 'reject', 'Từ chối tin'
        HIDE = 'hide', 'Tạm ẩn tin'
        RESTORE = 'restore', 'Khôi phục hiển thị'

    class Reason(models.TextChoices):
        INCOMPLETE_CONTENT = 'incomplete_content', 'Nội dung chưa đầy đủ'
        MISLEADING_CONTENT = 'misleading_content', 'Nội dung gây hiểu nhầm'
        PROHIBITED_CONTENT = 'prohibited_content', 'Nội dung bị cấm'
        FRAUD_RISK = 'fraud_risk', 'Có dấu hiệu lừa đảo'
        DUPLICATE_POSTING = 'duplicate_posting', 'Tin trùng lặp'
        CONFIRMED_REPORT = 'confirmed_report', 'Báo cáo vi phạm đã xác nhận'
        OTHER = 'other', 'Lý do khác'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.PROTECT,
        related_name='moderation_events',
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    reason_code = models.CharField(max_length=40, choices=Reason.choices, blank=True)
    note = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    source_report = models.ForeignKey(
        'jobs.JobReport',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='moderation_events',
    )
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50, blank=True)
    from_hold = models.CharField(max_length=24, blank=True)
    to_hold = models.CharField(max_length=24, blank=True)
    content_fingerprint = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['job', '-created_at'], name='job_moderation_event_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jmev')
        super().save(*args, **kwargs)
