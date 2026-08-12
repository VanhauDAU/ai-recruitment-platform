from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models

from .catalog import ServicePackage

SUPPORTED_CAPABILITY_CODES = (
    'sponsored_placement',
    'card_tone',
    'urgent_label',
    'job_refresh',
    'job_alert',
    'saved_remarketing',
    'visibility_extension',
)

CAPABILITY_CONFIGURATION_RULES = {
    'sponsored_placement': {
        'key': 'placement',
        'values': {'search_sponsored', 'best_jobs_eligible'},
    },
    'card_tone': {
        'key': 'tone',
        'values': {'orange', 'green', 'green_strong'},
    },
}


class ServiceCapability(models.Model):
    """A closed registry of commercial effects understood by application code."""

    class Code(models.TextChoices):
        SPONSORED_PLACEMENT = 'sponsored_placement', 'Vị trí tài trợ'
        CARD_TONE = 'card_tone', 'Màu nền tin tài trợ'
        URGENT_LABEL = 'urgent_label', 'Nhãn GẤP'
        JOB_REFRESH = 'job_refresh', 'Làm mới tin'
        JOB_ALERT = 'job_alert', 'Job Alert'
        SAVED_REMARKETING = 'saved_remarketing', 'Remarketing tin đã lưu'
        VISIBILITY_EXTENSION = 'visibility_extension', 'Gia hạn vòng đời tin'

    class Scope(models.TextChoices):
        JOB = 'job', 'Tin tuyển dụng'
        COMPANY = 'company', 'Doanh nghiệp'
        PLACEMENT = 'placement', 'Vị trí hiển thị'

    class EffectType(models.TextChoices):
        PLACEMENT = 'placement', 'Phân phối tài trợ'
        PRESENTATION = 'presentation', 'Trình bày tin'
        LABEL = 'label', 'Nhãn ngữ nghĩa'
        REFRESH = 'refresh', 'Làm mới'
        ALERT = 'alert', 'Thông báo việc làm'
        REMARKETING = 'remarketing', 'Remarketing'
        LIFECYCLE = 'lifecycle', 'Vòng đời tin'

    code = models.SlugField(max_length=64, unique=True, choices=Code.choices)
    name_vi = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    description_vi = models.TextField(blank=True)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.JOB)
    effect_type = models.CharField(max_length=20, choices=EffectType.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__in=SUPPORTED_CAPABILITY_CODES),
                name='services_capability_supported_code',
            )
        ]
        verbose_name = 'Quyền lợi dịch vụ'
        verbose_name_plural = 'Quyền lợi dịch vụ'

    def __str__(self):
        return self.name_vi

    def save(self, *args, **kwargs):
        if self.pk:
            original = type(self).objects.filter(pk=self.pk).first()
            if original and (
                original.code != self.code
                or original.scope != self.scope
                or original.effect_type != self.effect_type
            ):
                raise ValidationError('Không thể đổi mã, phạm vi hoặc handler của capability.')
        self.full_clean()
        return super().save(*args, **kwargs)


class ServicePackageVersion(models.Model):
    """Immutable commercial terms published for a marketing package."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Bản nháp'
        PUBLISHED = 'published', 'Đang phát hành'
        ARCHIVED = 'archived', 'Đã lưu trữ'

    package = models.ForeignKey(ServicePackage, on_delete=models.PROTECT, related_name='versions')
    version_number = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    price = models.DecimalField(
        max_digits=14,
        decimal_places=0,
        validators=[MinValueValidator(0)],
    )
    currency = models.CharField(
        max_length=3,
        default='VND',
        validators=[RegexValidator(r'^[A-Z]{3}$', 'Mã tiền tệ phải gồm 3 chữ cái in hoa.')],
    )
    activate_within_days = models.PositiveSmallIntegerField(
        default=90,
        validators=[MinValueValidator(1), MaxValueValidator(3650)],
        help_text='Số ngày khách hàng được phép bắt đầu sử dụng sau khi được cấp lượt.',
    )
    terms_vi = models.TextField(blank=True)
    terms_en = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    IMMUTABLE_FIELDS = (
        'package_id',
        'version_number',
        'price',
        'currency',
        'activate_within_days',
        'terms_vi',
        'terms_en',
    )

    class Meta:
        ordering = ['package_id', '-version_number']
        constraints = [
            models.UniqueConstraint(
                fields=['package', 'version_number'],
                name='services_package_version_unique_number',
            ),
            models.UniqueConstraint(
                fields=['package'],
                condition=models.Q(status='published'),
                name='services_package_one_published_version',
            ),
            models.CheckConstraint(
                condition=models.Q(price__gte=0),
                name='services_package_version_nonnegative_price',
            ),
            models.CheckConstraint(
                condition=models.Q(activate_within_days__gte=1),
                name='services_package_version_positive_activation_window',
            ),
        ]
        verbose_name = 'Phiên bản gói dịch vụ'
        verbose_name_plural = 'Phiên bản gói dịch vụ'

    def save(self, *args, **kwargs):
        if self.pk:
            original = type(self).objects.filter(pk=self.pk).first()
            if original and original.status != self.Status.DRAFT:
                changed_fields = [
                    field
                    for field in self.IMMUTABLE_FIELDS
                    if getattr(original, field) != getattr(self, field)
                ]
                if changed_fields:
                    raise ValidationError(
                        'Không thể sửa điều khoản của phiên bản đã phát hành: '
                        + ', '.join(changed_fields)
                    )
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status != self.Status.DRAFT:
            raise ValidationError('Phiên bản đã phát hành chỉ được lưu trữ, không được xóa.')
        return super().delete(*args, **kwargs)

    def __str__(self):
        return f'{self.package.name_vi} v{self.version_number}'


class ServicePackageVersionItem(models.Model):
    """Structured capability, quantity and duration included in one version."""

    package_version = models.ForeignKey(
        ServicePackageVersion,
        on_delete=models.CASCADE,
        related_name='items',
    )
    capability = models.ForeignKey(
        ServiceCapability,
        on_delete=models.PROTECT,
        related_name='version_items',
    )
    quantity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
    )
    duration_days = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(3650)],
        help_text='Để trống với quyền lợi tức thời như một lượt làm mới.',
    )
    configuration = models.JSONField(default=dict, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['package_version', 'capability'],
                name='services_package_version_unique_capability',
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name='services_package_item_positive_quantity',
            ),
            models.CheckConstraint(
                condition=models.Q(duration_days__isnull=True) | models.Q(duration_days__gte=1),
                name='services_package_item_positive_duration',
            ),
        ]
        verbose_name = 'Quyền lợi trong phiên bản gói'
        verbose_name_plural = 'Quyền lợi trong phiên bản gói'

    def clean(self):
        super().clean()
        if not isinstance(self.configuration, dict):
            raise ValidationError({'configuration': 'Cấu hình phải là một object JSON.'})
        rule = CAPABILITY_CONFIGURATION_RULES.get(self.capability.code)
        if rule is None:
            if self.configuration:
                raise ValidationError(
                    {'configuration': 'Quyền lợi này không nhận cấu hình tùy chỉnh.'}
                )
            return
        if set(self.configuration) != {rule['key']}:
            raise ValidationError(
                {'configuration': f'Cấu hình chỉ chấp nhận trường {rule["key"]}.'}
            )
        if self.configuration[rule['key']] not in rule['values']:
            raise ValidationError({'configuration': 'Giá trị cấu hình không được hỗ trợ.'})

    def save(self, *args, **kwargs):
        if (
            self.package_version_id
            and self.package_version.status != ServicePackageVersion.Status.DRAFT
        ):
            raise ValidationError('Không thể sửa quyền lợi của phiên bản đã phát hành.')
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.package_version.status != ServicePackageVersion.Status.DRAFT:
            raise ValidationError('Không thể xóa quyền lợi của phiên bản đã phát hành.')
        return super().delete(*args, **kwargs)

    def __str__(self):
        return f'{self.package_version}: {self.capability.code}'
