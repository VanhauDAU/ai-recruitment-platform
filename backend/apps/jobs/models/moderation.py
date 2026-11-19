from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id


class JobModerationEvent(models.Model):
    """Immutable evidence for administrator decisions about one job revision."""

    class Action(models.TextChoices):
        # Written only before post-moderation (ADR-0014); kept to read old events.
        APPROVE = 'approve', gettext_lazy('Duyệt tin (lịch sử)')
        REJECT = 'reject', gettext_lazy('Từ chối tin (lịch sử)')
        HIDE = 'hide', gettext_lazy('Tạm ẩn tin')
        RESTORE = 'restore', gettext_lazy('Khôi phục hiển thị')
        REQUEST_CHANGES = 'request_changes', gettext_lazy('Yêu cầu chỉnh sửa')
        RESUBMIT = 'resubmit', gettext_lazy('Nhà tuyển dụng gửi duyệt lại')

    class Reason(models.TextChoices):
        INCOMPLETE_CONTENT = 'incomplete_content', gettext_lazy('Nội dung chưa đầy đủ')
        MISLEADING_CONTENT = 'misleading_content', gettext_lazy('Nội dung gây hiểu nhầm')
        PROHIBITED_CONTENT = 'prohibited_content', gettext_lazy('Nội dung bị cấm')
        FRAUD_RISK = 'fraud_risk', gettext_lazy('Có dấu hiệu lừa đảo')
        DUPLICATE_POSTING = 'duplicate_posting', gettext_lazy('Tin trùng lặp')
        CONFIRMED_REPORT = 'confirmed_report', gettext_lazy('Báo cáo vi phạm đã xác nhận')
        OTHER = 'other', gettext_lazy('Lý do khác')

    # Reasons the owner can fix by editing; the others keep the job locked.
    FIXABLE_REASONS = (
        Reason.INCOMPLETE_CONTENT,
        Reason.MISLEADING_CONTENT,
        Reason.DUPLICATE_POSTING,
        Reason.OTHER,
    )

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

    def __str__(self):
        return self.public_id

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError('JobModerationEvent là lịch sử bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('jmev')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('JobModerationEvent là lịch sử bất biến.')
