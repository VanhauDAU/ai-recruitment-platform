from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id

from .choices import BudgetSource


class RecruitmentCampaign(models.Model):
    """A recruiter-owned hiring round: time window, budget and its jobs.

    Position, level and headcount belong to each job, so one campaign can hire
    a director and several staff at once; the campaign headcount is the sum of
    its jobs' vacancies. A company remains the legal publisher of a job, but it
    deliberately does not grant access to a campaign. The owning recruiter is
    the sole tenant.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        SCHEDULED = 'scheduled', 'Đã lên lịch'
        ACTIVE = 'active', 'Đang chạy'
        PAUSED = 'paused', 'Tạm dừng'
        COMPLETED = 'completed', 'Hoàn tất'
        CANCELLED = 'cancelled', 'Đã hủy'

    class PolicyHold(models.TextChoices):
        NONE = '', 'Không giữ'
        TEMPORARY_LOCK = 'temporary_lock', 'Tạm giữ do khóa tài khoản'
        BAN_REVIEW = 'ban_review', 'Giữ để rà soát sau cấm'
        LEGACY_LOCK = 'legacy_lock', 'Giữ do trạng thái khóa cũ'

    class EndedBy(models.TextChoices):
        NONE = '', 'Chưa kết thúc'
        USER = 'user', 'Nhà tuyển dụng'
        SYSTEM = 'system', 'Hệ thống'

    TERMINAL_STATUSES = frozenset({Status.COMPLETED, Status.CANCELLED})
    NON_TERMINAL_STATUSES = frozenset(
        {Status.DRAFT, Status.SCHEDULED, Status.ACTIVE, Status.PAUSED}
    )

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='recruitment_campaigns',
    )
    owner = models.ForeignKey(
        'employers.RecruiterProfile', on_delete=models.CASCADE, related_name='campaigns'
    )
    source_need = models.ForeignKey(
        'employers.RecruitmentNeed',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='campaigns',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    # Public landing page /tuyen-dung/<slug>; the slug is frozen once the
    # campaign has run so links already shared keep working.
    slug = models.SlugField(max_length=255, unique=True, null=True, blank=True)
    landing_intro = models.TextField(blank=True)
    landing_enabled = models.BooleanField(default=True)
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    is_continuous = models.BooleanField(default=False)
    budget_min = models.PositiveBigIntegerField(null=True, blank=True)
    budget_max = models.PositiveBigIntegerField(null=True, blank=True)
    budget_source = models.CharField(
        max_length=20, choices=BudgetSource.choices, default=BudgetSource.COMPANY
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    policy_hold = models.CharField(
        max_length=24,
        choices=PolicyHold.choices,
        default=PolicyHold.NONE,
        blank=True,
    )
    # Running-time bookkeeping: health metrics divide by days actually active,
    # not by calendar age, so pauses do not dilute the CV velocity.
    first_activated_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    active_seconds_accumulated = models.PositiveBigIntegerField(default=0)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.CharField(
        max_length=10, choices=EndedBy.choices, default=EndedBy.NONE, blank=True
    )
    policy_held_at = models.DateTimeField(null=True, blank=True)
    policy_hold_transition = models.ForeignKey(
        'accounts.AccountStatusTransition',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='held_campaigns',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['owner', 'status', '-created_at'], name='emp_camp_owner_status_idx'
            ),
            models.Index(
                fields=['policy_hold', 'status'],
                name='emp_camp_hold_status_idx',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_date__isnull=True)
                | models.Q(target_date__isnull=True)
                | models.Q(target_date__gte=models.F('start_date')),
                name='emp_camp_target_after_start',
            ),
            models.CheckConstraint(
                condition=models.Q(budget_min__isnull=True)
                | models.Q(budget_max__isnull=True)
                | models.Q(budget_max__gte=models.F('budget_min')),
                name='emp_camp_budget_range',
            ),
        ]
        ordering = ['-created_at']

    @property
    def is_terminal(self):
        return self.status in self.TERMINAL_STATUSES

    def build_slug(self):
        return f'{slugify(self.name)[:200]}-{self.public_id}'.strip('-').replace('_', '-')

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('camp')
        if not self.slug:
            self.slug = self.build_slug()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CampaignActivity(models.Model):
    """Employer-visible audit events for one recruitment campaign."""

    class Group(models.TextChoices):
        CAMPAIGN = 'campaign', 'Chiến dịch'
        JOB = 'job', 'Tin tuyển dụng'
        APPLICATION = 'application', 'Ứng viên'

    class EventType(models.TextChoices):
        LEGACY_SYNCED = 'legacy_synced', 'Đồng bộ dữ liệu hiện có'
        CAMPAIGN_CREATED = 'campaign_created', 'Tạo chiến dịch'
        CAMPAIGN_UPDATED = 'campaign_updated', 'Cập nhật chiến dịch'
        CAMPAIGN_PAUSED = 'campaign_paused', 'Dừng chiến dịch'
        CAMPAIGN_RESUMED = 'campaign_resumed', 'Mở lại chiến dịch'
        CAMPAIGN_SCHEDULED = 'campaign_scheduled', 'Lên lịch kích hoạt'
        CAMPAIGN_UNSCHEDULED = 'campaign_unscheduled', 'Hủy lịch kích hoạt'
        CAMPAIGN_ACTIVATED = 'campaign_activated', 'Kích hoạt chiến dịch'
        CAMPAIGN_ACTIVATION_FAILED = 'campaign_activation_failed', 'Kích hoạt theo lịch thất bại'
        CAMPAIGN_COMPLETED = 'campaign_completed', 'Hoàn tất chiến dịch'
        CAMPAIGN_CANCELLED = 'campaign_cancelled', 'Hủy chiến dịch'
        CHANNEL_ADDED = 'channel_added', 'Thêm kênh phân phối'
        CHANNEL_POSTED = 'channel_posted', 'Đã đăng lên kênh'
        SOCIAL_POST_PUBLISHED = 'social_post_published', 'Đã đăng lên Fanpage'
        SOCIAL_POST_DELETED = 'social_post_deleted', 'Đã gỡ bài khỏi Fanpage'
        JOB_ADDED = 'job_added', 'Thêm tin tuyển dụng'
        JOB_REMOVED = 'job_removed', 'Gỡ tin tuyển dụng'
        JOB_UPDATED = 'job_updated', 'Cập nhật tin tuyển dụng'
        JOB_STATUS_CHANGED = 'job_status_changed', 'Đổi trạng thái tin'
        APPLICATION_RECEIVED = 'application_received', 'Nhận CV ứng tuyển'
        APPLICATION_STATUS_CHANGED = (
            'application_status_changed',
            'Đổi trạng thái ứng viên',
        )
        ACCOUNT_POLICY_HELD = 'account_policy_held', 'Giữ do trạng thái tài khoản'
        ACCOUNT_POLICY_RELEASED = (
            'account_policy_released',
            'Gỡ giữ do trạng thái tài khoản',
        )

    campaign = models.ForeignKey(
        RecruitmentCampaign,
        on_delete=models.CASCADE,
        related_name='activities',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='campaign_activities',
    )
    group = models.CharField(max_length=20, choices=Group.choices)
    event_type = models.CharField(max_length=50, choices=EventType.choices)
    subject_public_id = models.CharField(max_length=50, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ['-occurred_at', '-id']
        indexes = [
            models.Index(
                fields=['campaign', '-occurred_at'],
                name='emp_camp_activity_time_idx',
            ),
            models.Index(
                fields=['campaign', 'group', '-occurred_at'],
                name='emp_camp_activity_group_idx',
            ),
        ]

    def __str__(self):
        return f'{self.campaign_id}:{self.event_type}'
