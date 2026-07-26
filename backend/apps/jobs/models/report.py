"""Báo cáo tin tuyển dụng do ứng viên gửi và kết luận của quản trị viên."""

from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


class JobReport(models.Model):
    """Một lượt báo cáo tin đăng.

    Chỉ báo cáo `UPHELD` (admin xác nhận vi phạm) mới ảnh hưởng huy hiệu xác
    thực của nhà tuyển dụng; báo cáo đang chờ hoặc bị bác không tính, nếu không
    bất kỳ ai cũng có thể gỡ tick của đối thủ bằng cách spam báo cáo.
    """

    class Reason(models.TextChoices):
        FAKE_COMPANY = 'fake_company', 'Công ty không có thật'
        SCAM = 'scam', 'Lừa đảo, thu phí ứng viên'
        WRONG_INFO = 'wrong_info', 'Thông tin tin đăng sai sự thật'
        DUPLICATE = 'duplicate', 'Tin trùng lặp'
        EXPIRED = 'expired', 'Tin đã tuyển xong nhưng chưa gỡ'
        OTHER = 'other', 'Lý do khác'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ xử lý'
        UPHELD = 'upheld', 'Xác nhận vi phạm'
        DISMISSED = 'dismissed', 'Bác bỏ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_reports',
    )
    reason = models.CharField(max_length=30, choices=Reason.choices)
    detail = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    resolution_note = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_reports_resolved',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Một người chỉ báo cáo một tin một lần để số liệu không bị thổi phồng.
            models.UniqueConstraint(
                fields=['job', 'reporter'],
                condition=models.Q(reporter__isnull=False),
                name='jobs_unique_report_per_reporter',
            ),
        ]
        indexes = [
            models.Index(fields=['status', '-created_at'], name='jobs_report_status_idx'),
            models.Index(fields=['job', 'status'], name='jobs_report_job_status_idx'),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jrep')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.public_id} - {self.job_id} - {self.status}'
