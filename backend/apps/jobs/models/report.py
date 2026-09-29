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
    job = models.ForeignKey('jobs.Job', on_delete=models.PROTECT, related_name='reports')
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_reports',
    )
    # Durable subject snapshots keep moderation/trust evidence attributable
    # even if an account or job relationship is later changed or deleted.
    job_public_id_snapshot = models.CharField(max_length=50, blank=True)
    company_id_snapshot = models.BigIntegerField(null=True, blank=True)
    posted_by_id_snapshot = models.BigIntegerField(null=True, blank=True)
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
            models.Index(
                fields=['posted_by_id_snapshot', 'status', 'reason'],
                name='jobs_report_trust_idx',
            ),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jrep')
        if self.job_id and not self.job_public_id_snapshot:
            job = self.job
            self.job_public_id_snapshot = job.public_id
            self.company_id_snapshot = job.company_id
            self.posted_by_id_snapshot = job.posted_by_id
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('JobReport là bằng chứng kiểm duyệt cần được lưu giữ.')

    def __str__(self):
        return f'{self.public_id} - {self.job_id} - {self.status}'


class JobReportResolutionEvent(models.Model):
    """Lịch sử bất biến cho mọi lần kết luận hoặc đảo kết luận báo cáo."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    report = models.ForeignKey(
        JobReport,
        on_delete=models.PROTECT,
        related_name='resolution_history',
    )
    from_status = models.CharField(max_length=20, choices=JobReport.Status.choices)
    to_status = models.CharField(max_length=20, choices=JobReport.Status.choices)
    note = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_report_resolution_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(
                fields=['report', 'created_at'],
                name='jobs_report_event_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError('JobReportResolutionEvent là lịch sử bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('jre')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('JobReportResolutionEvent là lịch sử bất biến.')

    def __str__(self):
        return f'{self.report_id}: {self.from_status} -> {self.to_status}'
