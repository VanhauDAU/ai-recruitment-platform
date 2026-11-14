"""Candidate reports about a public company page and their admin resolutions."""

from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from .company import Company


class CompanyReport(models.Model):
    """One report about the content of a public company page.

    Unlike a job report, a resolution never touches the recruiter trust badge;
    its only possible consequence is a policy hold on the page.
    """

    class Reason(models.TextChoices):
        WRONG_INFO = 'wrong_info', 'Thông tin công ty sai sự thật'
        IMPERSONATION = 'impersonation', 'Mạo danh doanh nghiệp khác'
        INAPPROPRIATE_CONTENT = 'inappropriate_content', 'Nội dung hoặc hình ảnh không phù hợp'
        SCAM = 'scam', 'Dấu hiệu lừa đảo'
        OTHER = 'other', 'Lý do khác'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ xử lý'
        UPHELD = 'upheld', 'Xác nhận vi phạm'
        DISMISSED = 'dismissed', 'Bác bỏ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name='reports')
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='company_reports',
    )
    # The names the page carried when it was reported: a later rename must not
    # rewrite the evidence of an impersonation or wrong-information report.
    company_name_snapshot = models.CharField(max_length=255, blank=True)
    trade_name_snapshot = models.CharField(max_length=255, blank=True)
    # A key of ``employers.page_registry``, or blank for the page as a whole.
    # Validated at the API, not by choices, so the registry can evolve freely.
    section_key = models.CharField(max_length=32, blank=True)
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
        related_name='company_reports_resolved',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # One open report per reporter and company; once it is resolved
            # they may report the page again.
            models.UniqueConstraint(
                fields=['company', 'reporter'],
                condition=models.Q(status='pending'),
                name='emp_co_report_one_pending',
            ),
        ]
        indexes = [
            models.Index(fields=['status', '-created_at'], name='emp_co_report_status_idx'),
            models.Index(fields=['company', 'status'], name='emp_co_report_company_idx'),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.public_id = generate_public_id('crp')
            # One explicit read: callers usually hold a deferred company row.
            self.company_name_snapshot, self.trade_name_snapshot = Company.objects.values_list(
                'company_name', 'trade_name'
            ).get(pk=self.company_id)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('CompanyReport là bằng chứng kiểm duyệt cần được lưu giữ.')

    def __str__(self):
        return f'{self.public_id} - {self.company_id} - {self.status}'


class CompanyReportResolutionEvent(models.Model):
    """Immutable history of every resolution and reopening of a report."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    report = models.ForeignKey(
        CompanyReport,
        on_delete=models.PROTECT,
        related_name='resolution_history',
    )
    from_status = models.CharField(max_length=20, choices=CompanyReport.Status.choices)
    to_status = models.CharField(max_length=20, choices=CompanyReport.Status.choices)
    note = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='company_report_resolution_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(
                fields=['report', 'created_at'],
                name='emp_co_report_event_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError('CompanyReportResolutionEvent là lịch sử bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('crpe')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('CompanyReportResolutionEvent là lịch sử bất biến.')

    def __str__(self):
        return f'{self.report_id}: {self.from_status} -> {self.to_status}'
