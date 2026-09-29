from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from common.public_id import generate_public_id


class Announcement(models.Model):
    class LifecycleState(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        PUBLISHED = 'published', 'Đã phát hành'
        PAUSED = 'paused', 'Đang tạm dừng'
        ARCHIVED = 'archived', 'Đã lưu trữ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    internal_name = models.CharField(max_length=200)
    lifecycle_state = models.CharField(
        max_length=20,
        choices=LifecycleState.choices,
        default=LifecycleState.DRAFT,
    )
    active_revision = models.ForeignKey(
        'AnnouncementRevision',
        related_name='+',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    revision_token = models.PositiveIntegerField(default=1)
    dismissal_version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='announcements_created',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='announcements_published',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        indexes = [
            models.Index(
                fields=['lifecycle_state', '-updated_at'],
                name='site_ann_state_updated_idx',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    lifecycle_state__in=[
                        'draft',
                        'published',
                        'paused',
                        'archived',
                    ]
                ),
                name='chk_site_ann_lifecycle',
            ),
            models.CheckConstraint(
                condition=Q(revision_token__gte=1),
                name='chk_site_ann_revision_token',
            ),
            models.CheckConstraint(
                condition=Q(dismissal_version__gte=1),
                name='chk_site_ann_dismiss_version',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ann')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.internal_name


class AnnouncementRevision(models.Model):
    class Kind(models.TextChoices):
        CRITICAL = 'critical', 'Sự cố nghiêm trọng'
        SECURITY = 'security', 'Bảo mật'
        COMPLIANCE = 'compliance', 'Pháp lý / tuân thủ'
        WARNING = 'warning', 'Cảnh báo'
        MAINTENANCE = 'maintenance', 'Bảo trì'
        INFO = 'info', 'Thông tin'
        SUCCESS = 'success', 'Thành công'
        EVENT = 'event', 'Sự kiện'
        FEATURE = 'feature', 'Tính năng'

    class Animation(models.TextChoices):
        SLIDE = 'slide', 'Trượt dọc'
        FADE = 'fade', 'Mờ dần'
        STATIC = 'static', 'Tĩnh'

    class DismissMode(models.TextChoices):
        LOCKED = 'locked', 'Không thể đóng'
        CLOSE = 'close', 'Đóng'
        SNOOZE = 'snooze', 'Tạm ẩn'

    class Surface(models.TextChoices):
        CANDIDATE = 'candidate', 'Ứng viên'
        EMPLOYER_MARKETING = 'employer_marketing', 'Trang nhà tuyển dụng'
        EMPLOYER_WORKSPACE = 'employer_workspace', 'Workspace nhà tuyển dụng'
        ADMIN_WORKSPACE = 'admin_workspace', 'Workspace quản trị'

    class Audience(models.TextChoices):
        GUEST = 'guest', 'Khách'
        AUTHENTICATED = 'authenticated', 'Đã đăng nhập'

    class Icon(models.TextChoices):
        ALERT_TRIANGLE = 'alert-triangle', 'Cảnh báo'
        BELL = 'bell', 'Chuông'
        CHECK_CIRCLE = 'check-circle', 'Thành công'
        INFO = 'info', 'Thông tin'
        LOCK = 'lock', 'Bảo mật'
        MEGAPHONE = 'megaphone', 'Loa'
        SHIELD = 'shield', 'Khiên'
        SPARKLES = 'sparkles', 'Lấp lánh'
        WRENCH = 'wrench', 'Bảo trì'

    class ThemeMode(models.TextChoices):
        KIND = 'kind', 'Theo loại thông báo'
        PRESET = 'preset', 'Bảng màu có sẵn'
        CUSTOM = 'custom', 'Màu tùy chỉnh'

    class ThemePreset(models.TextChoices):
        BRAND = 'brand', 'Thương hiệu'
        EMERALD = 'emerald', 'Xanh ngọc'
        AMBER = 'amber', 'Hổ phách'
        ROSE = 'rose', 'Hồng'
        VIOLET = 'violet', 'Tím'
        SLATE = 'slate', 'Xám'
        OCEAN = 'ocean', 'Xanh biển'

    class BackgroundFit(models.TextChoices):
        COVER = 'cover', 'Phủ toàn dải'
        REPEAT_X = 'repeat-x', 'Lặp ngang'
        CONTAIN = 'contain', 'Vừa khung'

    class BackgroundPosition(models.TextChoices):
        CENTER = 'center', 'Giữa'
        TOP = 'top', 'Trên'
        BOTTOM = 'bottom', 'Dưới'

    class BackgroundOverlay(models.TextChoices):
        NONE = 'none', 'Không phủ'
        LIGHT = 'light', 'Phủ sáng'
        DARK = 'dark', 'Phủ tối'

    announcement = models.ForeignKey(
        Announcement,
        related_name='revisions',
        on_delete=models.CASCADE,
    )
    number = models.PositiveIntegerField()
    message_vi = models.CharField(max_length=500)
    message_en = models.CharField(max_length=500, blank=True)
    badge_vi = models.CharField(max_length=80, blank=True)
    badge_en = models.CharField(max_length=80, blank=True)
    icon = models.CharField(max_length=30, choices=Icon.choices, default=Icon.INFO)
    cta_label_vi = models.CharField(max_length=100, blank=True)
    cta_label_en = models.CharField(max_length=100, blank=True)
    cta_url = models.CharField(max_length=1000, blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.INFO)
    surfaces = models.JSONField(default=list)
    auth_audiences = models.JSONField(default=list)
    roles = models.JSONField(default=list, blank=True)
    include_path_prefixes = models.JSONField(default=list, blank=True)
    exclude_path_prefixes = models.JSONField(default=list, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    priority = models.SmallIntegerField(default=50)
    animation = models.CharField(
        max_length=20,
        choices=Animation.choices,
        default=Animation.SLIDE,
    )
    display_seconds = models.PositiveSmallIntegerField(default=6)
    dismiss_mode = models.CharField(
        max_length=20,
        choices=DismissMode.choices,
        default=DismissMode.CLOSE,
    )
    snooze_seconds = models.PositiveIntegerField(null=True, blank=True)
    # Visual theme (AN-V1): mặc định theo kind; preset/custom + ảnh nền decorative.
    theme_mode = models.CharField(
        max_length=20,
        choices=ThemeMode.choices,
        default=ThemeMode.KIND,
    )
    theme_preset = models.CharField(
        max_length=20,
        choices=ThemePreset.choices,
        blank=True,
        default='',
    )
    color_accent = models.CharField(max_length=7, blank=True, default='')
    color_bg_from = models.CharField(max_length=7, blank=True, default='')
    color_bg_to = models.CharField(max_length=7, blank=True, default='')
    color_fg = models.CharField(max_length=7, blank=True, default='')
    background_image = models.TextField(
        blank=True,
        default='',
        help_text='Storage key ảnh nền strip (vd. site/announcements/backgrounds/…)',
    )
    background_fit = models.CharField(
        max_length=20,
        choices=BackgroundFit.choices,
        default=BackgroundFit.COVER,
    )
    background_position = models.CharField(
        max_length=20,
        choices=BackgroundPosition.choices,
        default=BackgroundPosition.CENTER,
    )
    background_overlay = models.CharField(
        max_length=20,
        choices=BackgroundOverlay.choices,
        default=BackgroundOverlay.NONE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='announcement_revisions_created',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['announcement_id', '-number']
        constraints = [
            models.UniqueConstraint(
                fields=['announcement', 'number'],
                name='uq_site_ann_revision_number',
            ),
            models.CheckConstraint(
                condition=Q(number__gte=1),
                name='chk_site_ann_rev_number',
            ),
            models.CheckConstraint(
                condition=Q(priority__gte=0) & Q(priority__lte=1000),
                name='chk_site_ann_priority',
            ),
            models.CheckConstraint(
                condition=Q(display_seconds__gte=4) & Q(display_seconds__lte=15),
                name='chk_site_ann_display_seconds',
            ),
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True)
                | Q(starts_at__isnull=True)
                | Q(starts_at__lt=models.F('ends_at')),
                name='chk_site_ann_schedule',
            ),
            models.CheckConstraint(
                condition=~Q(kind='critical') | Q(ends_at__isnull=False),
                name='chk_site_ann_critical_end',
            ),
            models.CheckConstraint(
                condition=~Q(dismiss_mode='snooze')
                | Q(snooze_seconds__isnull=False, snooze_seconds__gte=60),
                name='chk_site_ann_snooze_seconds',
            ),
        ]
        indexes = [
            models.Index(
                fields=['announcement', '-number'],
                name='site_ann_rev_number_idx',
            ),
            models.Index(
                fields=['starts_at', 'ends_at'],
                name='site_ann_rev_schedule_idx',
            ),
        ]

    def clean(self):
        errors = {}
        if not self.message_vi.strip():
            errors['message_vi'] = 'Nội dung tiếng Việt là bắt buộc.'
        if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
            errors['ends_at'] = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
        if self.kind == self.Kind.CRITICAL and not self.ends_at:
            errors['ends_at'] = 'Thông báo critical bắt buộc có thời gian kết thúc.'
        if self.kind == self.Kind.CRITICAL and self.dismiss_mode != self.DismissMode.LOCKED:
            errors['dismiss_mode'] = 'Thông báo critical không thể dismiss.'
        if bool(self.cta_label_vi.strip()) != bool(self.cta_url.strip()):
            errors['cta_url'] = 'CTA tiếng Việt và URL phải được cấu hình cùng nhau.'
        if self.dismiss_mode == self.DismissMode.SNOOZE and not self.snooze_seconds:
            errors['snooze_seconds'] = 'Chế độ snooze cần thời lượng.'
        if self.dismiss_mode != self.DismissMode.SNOOZE and self.snooze_seconds is not None:
            errors['snooze_seconds'] = 'Chỉ cấu hình thời lượng cho chế độ snooze.'
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f'{self.announcement.public_id}:r{self.number}'


class AnnouncementUserState(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='announcement_states',
        on_delete=models.CASCADE,
    )
    announcement = models.ForeignKey(
        Announcement,
        related_name='user_states',
        on_delete=models.CASCADE,
    )
    dismissal_version = models.PositiveIntegerField()
    dismissed_at = models.DateTimeField(null=True, blank=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'announcement', 'dismissal_version'],
                name='uq_site_ann_user_state',
            ),
            models.CheckConstraint(
                condition=Q(dismissal_version__gte=1),
                name='chk_site_ann_state_version',
            ),
            models.CheckConstraint(
                condition=Q(dismissed_at__isnull=True) | Q(snoozed_until__isnull=True),
                name='chk_site_ann_one_state',
            ),
        ]
        indexes = [
            models.Index(
                fields=['user', 'announcement'],
                name='site_ann_state_user_idx',
            ),
        ]


class AnnouncementDailyMetric(models.Model):
    announcement_revision = models.ForeignKey(
        AnnouncementRevision,
        related_name='daily_metrics',
        on_delete=models.CASCADE,
    )
    date = models.DateField()
    surface = models.CharField(max_length=30, choices=AnnouncementRevision.Surface.choices)
    impressions = models.PositiveBigIntegerField(default=0)
    unique_impressions = models.PositiveBigIntegerField(default=0)
    clicks = models.PositiveBigIntegerField(default=0)
    unique_clicks = models.PositiveBigIntegerField(default=0)
    dismisses = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', 'surface']
        constraints = [
            models.UniqueConstraint(
                fields=['announcement_revision', 'date', 'surface'],
                name='uq_site_ann_metric_day_surface',
            ),
        ]
        indexes = [
            models.Index(
                fields=['date', 'surface'],
                name='site_ann_metric_date_idx',
            ),
        ]
