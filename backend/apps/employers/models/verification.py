"""Employer-account verification case, its event timeline and email outbox."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id

from .company import Company


class EmployerVerificationCase(models.Model):
    """Account-scoped proof that one recruiter may represent one company."""

    class VerificationMethod(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', gettext_lazy('Giấy đăng ký doanh nghiệp')
        AUTHORIZATION_AND_ID = (
            'authorization_and_id',
            gettext_lazy('Giấy ủy quyền + giấy tờ định danh'),
        )

    class Status(models.TextChoices):
        DRAFT = 'draft', gettext_lazy('Chưa nộp')
        PENDING = 'pending', gettext_lazy('Chờ duyệt')
        IN_REVIEW = 'in_review', gettext_lazy('Đang xử lý')
        CHANGES_REQUESTED = 'changes_requested', gettext_lazy('Cần bổ sung')
        REJECTED = 'rejected', gettext_lazy('Bị từ chối')
        APPROVED = 'approved', gettext_lazy('Đã xác thực')
        REVOKED = 'revoked', gettext_lazy('Đã thu hồi')
        EXPIRED = 'expired', gettext_lazy('Hết hiệu lực')

    class DecisionSource(models.TextChoices):
        EXPLICIT_ADMIN = 'explicit_admin', gettext_lazy('Quyết định quản trị tường minh')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.OneToOneField(
        'employers.RecruiterProfile',
        on_delete=models.CASCADE,
        related_name='verification_case',
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='recruiter_verification_cases',
    )
    verification_method = models.CharField(
        max_length=30,
        choices=VerificationMethod.choices,
        blank=True,
    )
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)
    revision = models.PositiveIntegerField(default=1)
    lock_version = models.PositiveIntegerField(default=0)
    final_rejection_count = models.PositiveSmallIntegerField(default=0)
    resubmission_locked_at = models.DateTimeField(null=True, blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    review_started_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_reason = models.TextField(blank=True)
    decision_source = models.CharField(
        max_length=24,
        choices=DecisionSource.choices,
        blank=True,
    )
    decision_snapshot = models.JSONField(default=dict, blank=True)
    tax_override_reason = models.TextField(blank=True)
    tax_override_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at', '-updated_at']
        indexes = [
            models.Index(
                fields=['status', '-submitted_at'],
                name='emp_verify_status_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.recruiter_id}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('evc')
        super().save(*args, **kwargs)


class EmployerVerificationEvent(models.Model):
    """Append-only event timeline for an employer verification case."""

    class EventType(models.TextChoices):
        SUBMITTED = 'submitted', gettext_lazy('Đã nộp')
        REVIEW_STARTED = 'review_started', gettext_lazy('Bắt đầu xử lý')
        DOCUMENT_REVIEWED = 'document_reviewed', gettext_lazy('Đã xử lý giấy tờ')
        DOCUMENT_REPLACED = 'document_replaced', gettext_lazy('Đã thay giấy tờ')
        CHANGES_REQUESTED = 'changes_requested', gettext_lazy('Yêu cầu bổ sung')
        RESUBMITTED = 'resubmitted', gettext_lazy('Đã nộp lại')
        RESUBMISSION_UNLOCKED = 'resubmission_unlocked', gettext_lazy('Đã mở khóa nộp lại')
        APPROVED = 'approved', gettext_lazy('Đã duyệt')
        REJECTED = 'rejected', gettext_lazy('Đã từ chối')
        REVOKED = 'revoked', gettext_lazy('Đã thu hồi')
        EXPIRED = 'expired', gettext_lazy('Hết hiệu lực')
        REAPPROVED = 'reapproved', gettext_lazy('Đã duyệt lại')
        HOLD_APPLIED = 'hold_applied', gettext_lazy('Đã áp dụng compliance hold')
        HOLD_RELEASED = 'hold_released', gettext_lazy('Đã gỡ compliance hold')
        SENSITIVE_VIEWED = 'sensitive_viewed', gettext_lazy('Đã xem dữ liệu nhạy cảm')
        TAX_LOOKUP_REFRESHED = 'tax_lookup_refreshed', gettext_lazy('Đã tra cứu lại mã số thuế')
        WITHDRAWN_BY_UNLINK = 'withdrawn_by_unlink', gettext_lazy('Đã rút do gỡ liên kết công ty')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    verification_case = models.ForeignKey(
        EmployerVerificationCase,
        on_delete=models.CASCADE,
        related_name='events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['verification_case', '-created_at'],
                name='emp_verify_event_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('eve')
        super().save(*args, **kwargs)


class EmployerVerificationNotification(models.Model):
    """Transactional outbox for recruiter-facing verification results."""

    class Status(models.TextChoices):
        PENDING = 'pending', gettext_lazy('Chờ gửi')
        SENDING = 'sending', gettext_lazy('Đang gửi')
        SENT = 'sent', gettext_lazy('Đã gửi')
        FAILED = 'failed', gettext_lazy('Gửi thất bại')

    verification_case = models.ForeignKey(
        EmployerVerificationCase,
        on_delete=models.CASCADE,
        related_name='notification_jobs',
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
    )
    event_type = models.CharField(max_length=32)
    dedupe_key = models.CharField(max_length=160)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    context = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                name='uniq_emp_verify_notice_dedupe',
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', 'created_at'],
                name='emp_verify_notice_queue_idx',
            ),
        ]

    def __str__(self):
        return f'{self.verification_case_id}:{self.event_type}:{self.status}'
