from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext_lazy

from apps.employers.models import BudgetSource
from common.db.public_id import generate_public_id


class RecruitmentCampaign(models.Model):
    """A recruiter-owned hiring round: time window, budget and its jobs.

    Position, level and headcount belong to each job, so one campaign can hire
    a director and several staff at once; the campaign headcount is the sum of
    its jobs' vacancies. A company remains the legal publisher of a job, but it
    deliberately does not grant access to a campaign. The owning recruiter is
    the sole tenant.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', gettext_lazy('Nháp')
        SCHEDULED = 'scheduled', gettext_lazy('Đã lên lịch')
        ACTIVE = 'active', gettext_lazy('Đang chạy')
        PAUSED = 'paused', gettext_lazy('Tạm dừng')
        COMPLETED = 'completed', gettext_lazy('Hoàn tất')
        CANCELLED = 'cancelled', gettext_lazy('Đã hủy')

    class PolicyHold(models.TextChoices):
        NONE = '', gettext_lazy('Không giữ')
        TEMPORARY_LOCK = 'temporary_lock', gettext_lazy('Tạm giữ do khóa tài khoản')
        BAN_REVIEW = 'ban_review', gettext_lazy('Giữ để rà soát sau cấm')
        LEGACY_LOCK = 'legacy_lock', gettext_lazy('Giữ do trạng thái khóa cũ')

    class EndedBy(models.TextChoices):
        NONE = '', gettext_lazy('Chưa kết thúc')
        USER = 'user', gettext_lazy('Nhà tuyển dụng')
        SYSTEM = 'system', gettext_lazy('Hệ thống')

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

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('camp')
        if not self.slug:
            self.slug = self.build_slug()
        super().save(*args, **kwargs)

    @property
    def is_terminal(self):
        return self.status in self.TERMINAL_STATUSES

    def active_seconds(self, *, now=None):
        """Seconds the campaign has actually been running, pauses excluded."""
        seconds = self.active_seconds_accumulated
        if self.status == self.Status.ACTIVE and self.activated_at:
            seconds += max(0, int(((now or timezone.now()) - self.activated_at).total_seconds()))
        return seconds

    def build_slug(self):
        return f'{slugify(self.name)[:200]}-{self.public_id}'.strip('-').replace('_', '-')


class CampaignActivityManager(models.Manager):
    def record(
        self,
        *,
        campaign,
        event_type,
        group,
        actor=None,
        subject_public_id='',
        metadata=None,
        occurred_at=None,
    ):
        """Record one explicit campaign-domain event from a mutation service."""
        if campaign is None:
            return None
        activity = self.create(
            campaign=campaign,
            actor=actor,
            group=group,
            event_type=event_type,
            subject_public_id=subject_public_id or '',
            metadata=metadata or {},
            occurred_at=occurred_at or timezone.now(),
        )
        # Keep create/update/status API responses consistent with a subsequent GET
        # without adding a read query solely to annotate the just-written event.
        campaign.last_activity_at = activity.occurred_at
        campaign.last_activity_type = activity.event_type
        return activity


class CampaignActivity(models.Model):
    """Employer-visible audit events for one recruitment campaign."""

    class Group(models.TextChoices):
        CAMPAIGN = 'campaign', gettext_lazy('Chiến dịch')
        JOB = 'job', gettext_lazy('Tin tuyển dụng')
        APPLICATION = 'application', gettext_lazy('Ứng viên')

    class EventType(models.TextChoices):
        LEGACY_SYNCED = 'legacy_synced', gettext_lazy('Đồng bộ dữ liệu hiện có')
        CAMPAIGN_CREATED = 'campaign_created', gettext_lazy('Tạo chiến dịch')
        CAMPAIGN_UPDATED = 'campaign_updated', gettext_lazy('Cập nhật chiến dịch')
        CAMPAIGN_PAUSED = 'campaign_paused', gettext_lazy('Dừng chiến dịch')
        CAMPAIGN_RESUMED = 'campaign_resumed', gettext_lazy('Mở lại chiến dịch')
        CAMPAIGN_SCHEDULED = 'campaign_scheduled', gettext_lazy('Lên lịch kích hoạt')
        CAMPAIGN_UNSCHEDULED = 'campaign_unscheduled', gettext_lazy('Hủy lịch kích hoạt')
        CAMPAIGN_ACTIVATED = 'campaign_activated', gettext_lazy('Kích hoạt chiến dịch')
        CAMPAIGN_ACTIVATION_FAILED = (
            'campaign_activation_failed',
            gettext_lazy('Kích hoạt theo lịch thất bại'),
        )
        CAMPAIGN_COMPLETED = 'campaign_completed', gettext_lazy('Hoàn tất chiến dịch')
        CAMPAIGN_CANCELLED = 'campaign_cancelled', gettext_lazy('Hủy chiến dịch')
        CHANNEL_ADDED = 'channel_added', gettext_lazy('Thêm kênh phân phối')
        CHANNEL_POSTED = 'channel_posted', gettext_lazy('Đã đăng lên kênh')
        SOCIAL_POST_PUBLISHED = 'social_post_published', gettext_lazy('Đã tự đăng bài')
        SOCIAL_POST_DELETED = 'social_post_deleted', gettext_lazy('Đã tự gỡ bài')
        JOB_ADDED = 'job_added', gettext_lazy('Thêm tin tuyển dụng')
        JOB_REMOVED = 'job_removed', gettext_lazy('Gỡ tin tuyển dụng')
        JOB_UPDATED = 'job_updated', gettext_lazy('Cập nhật tin tuyển dụng')
        JOB_STATUS_CHANGED = 'job_status_changed', gettext_lazy('Đổi trạng thái tin')
        APPLICATION_RECEIVED = 'application_received', gettext_lazy('Nhận CV ứng tuyển')
        APPLICATION_STATUS_CHANGED = (
            'application_status_changed',
            gettext_lazy('Đổi trạng thái ứng viên'),
        )
        ACCOUNT_POLICY_HELD = 'account_policy_held', gettext_lazy('Giữ do trạng thái tài khoản')
        ACCOUNT_POLICY_RELEASED = (
            'account_policy_released',
            gettext_lazy('Gỡ giữ do trạng thái tài khoản'),
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

    objects = CampaignActivityManager()

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
