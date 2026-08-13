from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from common.public_id import generate_public_id

from .commercial import ServiceCapability, ServicePackageVersion


class ServiceEntitlementUnit(models.Model):
    """One independently redeemable package unit owned by one company."""

    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Chưa sử dụng'
        CONSUMED = 'consumed', 'Đã sử dụng'
        EXPIRED = 'expired', 'Hết hạn kích hoạt'
        REVOKED = 'revoked', 'Đã thu hồi'

    class Source(models.TextChoices):
        MANUAL_GRANT = 'manual_grant', 'Cấp thủ công'
        ORDER = 'order', 'Đơn hàng'
        COMPENSATION = 'compensation', 'Bù dịch vụ'
        LEGACY = 'legacy', 'Chuyển đổi legacy'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        related_name='service_entitlement_units',
    )
    package_version = models.ForeignKey(
        ServicePackageVersion,
        on_delete=models.PROTECT,
        related_name='entitlement_units',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    source = models.CharField(max_length=24, choices=Source.choices)
    grant_key = models.CharField(max_length=100)
    unit_number = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    snapshot = models.JSONField(default=dict)
    granted_at = models.DateTimeField(default=timezone.now)
    activate_by = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_service_entitlement_units',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    IMMUTABLE_FIELDS = (
        'company_id',
        'package_version_id',
        'source',
        'grant_key',
        'unit_number',
        'snapshot',
        'granted_at',
        'activate_by',
        'created_by_id',
    )

    class Meta:
        ordering = ['activate_by', 'id']
        indexes = [
            models.Index(
                fields=['company', 'status', 'activate_by'],
                name='services_unit_inventory_idx',
            ),
            models.Index(fields=['status', 'activate_by'], name='services_unit_expiry_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'grant_key', 'unit_number'],
                name='services_unit_unique_grant_number',
            ),
            models.CheckConstraint(
                condition=Q(activate_by__gte=F('granted_at')),
                name='services_unit_valid_activation_window',
            ),
            models.CheckConstraint(
                condition=(Q(status='consumed', consumed_at__isnull=False))
                | (~Q(status='consumed') & Q(consumed_at__isnull=True)),
                name='services_unit_consumed_timestamp_state',
            ),
            models.CheckConstraint(
                condition=(Q(status='expired', expired_at__isnull=False))
                | (~Q(status='expired') & Q(expired_at__isnull=True)),
                name='services_unit_expired_timestamp_state',
            ),
            models.CheckConstraint(
                condition=(Q(status='revoked', revoked_at__isnull=False))
                | (~Q(status='revoked') & Q(revoked_at__isnull=True)),
                name='services_unit_revoked_timestamp_state',
            ),
        ]
        verbose_name = 'Lượt dịch vụ'
        verbose_name_plural = 'Lượt dịch vụ'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('seu')
        if self.pk:
            original = type(self).objects.filter(pk=self.pk).first()
            if original:
                changed_fields = [
                    field
                    for field in self.IMMUTABLE_FIELDS
                    if getattr(original, field) != getattr(self, field)
                ]
                if changed_fields:
                    raise ValidationError(
                        'Không thể sửa nguồn cấp của lượt dịch vụ: ' + ', '.join(changed_fields)
                    )
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Lượt dịch vụ chỉ được thu hồi hoặc hết hạn, không được xóa.')

    def __str__(self):
        return self.public_id


class JobServiceActivation(models.Model):
    """Permanent record attaching one consumed bundle unit to exactly one job."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Đang chạy'
        EXPIRED = 'expired', 'Đã kết thúc'
        TERMINATED = 'terminated', 'Đã dừng'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    unit = models.OneToOneField(
        ServiceEntitlementUnit,
        on_delete=models.PROTECT,
        related_name='activation',
    )
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        related_name='job_service_activations',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.PROTECT,
        related_name='service_activations',
    )
    idempotency_key = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    snapshot = models.JSONField(default=dict)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_job_service_activations',
    )
    terminated_at = models.DateTimeField(null=True, blank=True)
    termination_reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    IMMUTABLE_FIELDS = (
        'unit_id',
        'company_id',
        'job_id',
        'idempotency_key',
        'starts_at',
        'ends_at',
        'snapshot',
        'created_by_id',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job', 'status', 'ends_at'], name='services_job_active_idx'),
            models.Index(
                fields=['company', 'status', 'ends_at'],
                name='services_company_active_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'idempotency_key'],
                name='services_activation_company_idempotency',
            ),
            models.CheckConstraint(
                condition=Q(ends_at__gte=F('starts_at')),
                name='services_activation_valid_window',
            ),
        ]
        verbose_name = 'Lượt kích hoạt dịch vụ tin'
        verbose_name_plural = 'Lượt kích hoạt dịch vụ tin'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jsa')
        if self.pk:
            original = type(self).objects.filter(pk=self.pk).first()
            if original:
                changed_fields = [
                    field
                    for field in self.IMMUTABLE_FIELDS
                    if getattr(original, field) != getattr(self, field)
                ]
                if changed_fields:
                    raise ValidationError(
                        'Không thể sửa dữ liệu gốc của lượt kích hoạt: ' + ', '.join(changed_fields)
                    )
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Lịch sử kích hoạt không được xóa.')

    def __str__(self):
        return self.public_id


class JobServiceActivationItem(models.Model):
    activation = models.ForeignKey(
        JobServiceActivation,
        on_delete=models.PROTECT,
        related_name='items',
    )
    capability = models.ForeignKey(
        ServiceCapability,
        on_delete=models.PROTECT,
        related_name='activation_items',
    )
    total_quantity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    remaining_quantity = models.PositiveSmallIntegerField(validators=[MinValueValidator(0)])
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    configuration = models.JSONField(default=dict, blank=True)

    IMMUTABLE_FIELDS = (
        'activation_id',
        'capability_id',
        'total_quantity',
        'starts_at',
        'ends_at',
        'configuration',
    )

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(
                fields=['activation', 'capability'],
                name='services_activation_unique_capability',
            ),
            models.CheckConstraint(
                condition=Q(remaining_quantity__lte=F('total_quantity')),
                name='services_activation_item_remaining_lte_total',
            ),
            models.CheckConstraint(
                condition=Q(ends_at__gte=F('starts_at')),
                name='services_activation_item_valid_window',
            ),
        ]
        verbose_name = 'Quyền lợi đã kích hoạt'
        verbose_name_plural = 'Quyền lợi đã kích hoạt'

    def delete(self, *args, **kwargs):
        raise ValidationError('Lịch sử quyền lợi đã kích hoạt không được xóa.')

    def save(self, *args, **kwargs):
        if self.pk:
            original = type(self).objects.filter(pk=self.pk).first()
            if original:
                changed_fields = [
                    field
                    for field in self.IMMUTABLE_FIELDS
                    if getattr(original, field) != getattr(self, field)
                ]
                if changed_fields:
                    raise ValidationError(
                        'Không thể sửa dữ liệu gốc của quyền lợi đã kích hoạt: '
                        + ', '.join(changed_fields)
                    )
        self.full_clean()
        return super().save(*args, **kwargs)


class JobServiceUsageEvent(models.Model):
    """Append-only evidence for one consumed activation capability."""

    class EventType(models.TextChoices):
        REFRESH = 'refresh', 'Làm mới tin'
        JOB_ALERT = 'job_alert', 'Gửi Job Alert'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    activation = models.ForeignKey(
        JobServiceActivation,
        on_delete=models.PROTECT,
        related_name='usage_events',
    )
    activation_item = models.ForeignKey(
        JobServiceActivationItem,
        on_delete=models.PROTECT,
        related_name='usage_events',
    )
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        related_name='job_service_usage_events',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.PROTECT,
        related_name='service_usage_events',
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    idempotency_key = models.CharField(max_length=100)
    occurred_at = models.DateTimeField(default=timezone.now)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='job_service_usage_events',
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at', '-id']
        indexes = [
            models.Index(
                fields=['activation', 'event_type', 'occurred_at'],
                name='services_usage_activation_idx',
            ),
            models.Index(
                fields=['job', 'event_type', 'occurred_at'],
                name='services_usage_job_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'idempotency_key'],
                name='services_usage_company_idempotency',
            ),
        ]
        verbose_name = 'Lần sử dụng quyền lợi'
        verbose_name_plural = 'Lần sử dụng quyền lợi'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('Lần sử dụng quyền lợi không được sửa.')
        if not self.public_id:
            self.public_id = generate_public_id('jsu')
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Lịch sử sử dụng quyền lợi không được xóa.')

    def __str__(self):
        return f'{self.event_type}:{self.public_id}'


class JobPromotionMetricDaily(models.Model):
    """Privacy-safe aggregate measured while one sponsored activation is effective."""

    activation = models.ForeignKey(
        JobServiceActivation,
        on_delete=models.PROTECT,
        related_name='promotion_metrics',
    )
    date = models.DateField()
    impression_count = models.PositiveBigIntegerField(default=0)
    view_count = models.PositiveBigIntegerField(default=0)
    save_count = models.PositiveBigIntegerField(default=0)
    apply_count = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'id']
        indexes = [models.Index(fields=['date'], name='services_promo_metric_date_idx')]
        constraints = [
            models.UniqueConstraint(
                fields=['activation', 'date'],
                name='services_promo_metric_activation_date',
            ),
        ]
        verbose_name = 'Số liệu dịch vụ tin theo ngày'
        verbose_name_plural = 'Số liệu dịch vụ tin theo ngày'

    def __str__(self):
        return f'{self.activation_id}:{self.date}'


class JobServiceAlertDispatch(models.Model):
    """One paid, retryable Job Alert send to candidates with matching alerts."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Đang chuẩn bị'
        READY = 'ready', 'Sẵn sàng gửi'
        SENT = 'sent', 'Đã gửi'
        EMPTY = 'empty', 'Không có người nhận phù hợp'
        CANCELLED = 'cancelled', 'Đã hủy'
        FAILED = 'failed', 'Gửi thất bại'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    usage_event = models.OneToOneField(
        JobServiceUsageEvent,
        on_delete=models.PROTECT,
        related_name='alert_dispatch',
    )
    activation = models.ForeignKey(
        JobServiceActivation,
        on_delete=models.PROTECT,
        related_name='alert_dispatches',
    )
    activation_item = models.ForeignKey(
        JobServiceActivationItem,
        on_delete=models.PROTECT,
        related_name='alert_dispatches',
    )
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        related_name='job_service_alert_dispatches',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.PROTECT,
        related_name='service_alert_dispatches',
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    selection_cursor = models.PositiveBigIntegerField(default=0)
    selection_finished = models.BooleanField(default=False)
    recipient_count = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    cancelled_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['status', 'selection_finished', 'created_at'],
                name='services_alert_dispatch_idx',
            ),
            models.Index(fields=['activation', 'created_at'], name='services_alert_activation_idx'),
        ]
        verbose_name = 'Đợt gửi Job Alert'
        verbose_name_plural = 'Đợt gửi Job Alert'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jad')
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Đợt gửi Job Alert không được xóa.')


class JobServiceAlertRecipient(models.Model):
    """Per-candidate email outbox row; source criteria are rechecked before send."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Đang chờ gửi'
        SENDING = 'sending', 'Đang gửi'
        SENT = 'sent', 'Đã gửi'
        CANCELLED = 'cancelled', 'Đã hủy'
        FAILED = 'failed', 'Gửi thất bại'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    dispatch = models.ForeignKey(
        JobServiceAlertDispatch,
        on_delete=models.PROTECT,
        related_name='recipients',
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='service_job_alert_recipients',
    )
    recipient_email = models.EmailField()
    recipient_auth_revision = models.PositiveBigIntegerField()
    matched_alert_public_ids = models.JSONField(default=list, blank=True)
    message_id = models.CharField(max_length=255, unique=True, editable=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='services_alert_recipient_idx'),
            models.Index(fields=['candidate', 'created_at'], name='services_alert_candidate_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['dispatch', 'candidate'],
                name='services_alert_dispatch_candidate',
            ),
        ]
        verbose_name = 'Người nhận Job Alert'
        verbose_name_plural = 'Người nhận Job Alert'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jar')
        if not self.message_id:
            self.message_id = f'<job-alert.{self.public_id}@procv.vn>'
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Lịch sử gửi Job Alert không được xóa.')


class SavedJobRemarketingImpression(models.Model):
    """Purpose-limited delivery history for the paid saved-job lane."""

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_job_remarketing_impressions',
    )
    activation = models.ForeignKey(
        JobServiceActivation,
        on_delete=models.PROTECT,
        related_name='saved_remarketing_impressions',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.CASCADE,
        related_name='saved_remarketing_impressions',
    )
    shown_on = models.DateField()
    shown_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-shown_at', '-id']
        indexes = [
            models.Index(
                fields=['candidate', 'shown_at'],
                name='svc_saved_rem_cand_idx',
            ),
            models.Index(
                fields=['activation', 'shown_at'],
                name='svc_saved_rem_act_idx',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'job', 'shown_on'],
                name='services_saved_rem_once_per_day',
            ),
        ]
        verbose_name = 'Lượt hiển thị lại tin đã lưu'
        verbose_name_plural = 'Lượt hiển thị lại tin đã lưu'


class ServiceAuditEvent(models.Model):
    """Append-only commercial audit log; metadata stores human-readable context only."""

    class EventType(models.TextChoices):
        PACKAGE_PUBLISHED = 'package_published', 'Phát hành phiên bản gói'
        UNIT_GRANTED = 'unit_granted', 'Cấp lượt'
        UNIT_REVOKED = 'unit_revoked', 'Thu hồi lượt'
        UNIT_EXPIRED = 'unit_expired', 'Lượt hết hạn kích hoạt'
        UNIT_CONSUMED = 'unit_consumed', 'Sử dụng lượt'
        ACTIVATION_CREATED = 'activation_created', 'Kích hoạt dịch vụ'
        ACTIVATION_EXPIRED = 'activation_expired', 'Dịch vụ kết thúc'
        ACTIVATION_TERMINATED = 'activation_terminated', 'Dịch vụ bị dừng'
        CAPABILITY_USED = 'capability_used', 'Sử dụng quyền lợi'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    occurred_at = models.DateTimeField(default=timezone.now)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='service_audit_events',
    )
    company = models.ForeignKey(
        'employers.Company',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='service_audit_events',
    )
    package_version = models.ForeignKey(
        ServicePackageVersion,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='audit_events',
    )
    unit = models.ForeignKey(
        ServiceEntitlementUnit,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='audit_events',
    )
    activation = models.ForeignKey(
        JobServiceActivation,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='audit_events',
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['occurred_at', 'id']
        indexes = [
            models.Index(fields=['company', 'occurred_at'], name='services_audit_company_idx'),
            models.Index(fields=['event_type', 'occurred_at'], name='services_audit_type_idx'),
        ]
        verbose_name = 'Sự kiện kiểm toán dịch vụ'
        verbose_name_plural = 'Sự kiện kiểm toán dịch vụ'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('Sự kiện kiểm toán không được sửa.')
        if not self.public_id:
            self.public_id = generate_public_id('sae')
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Sự kiện kiểm toán không được xóa.')

    def __str__(self):
        return f'{self.event_type}:{self.public_id}'
