from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id


class EmployerNotificationPreference(models.Model):
    """Optional email preferences; important verification decisions are immutable-on."""

    recipient = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employer_notification_preference',
    )
    intermediate_verification_email = models.BooleanField(default=True)
    # Email for every new application to the recruiter's jobs (the bell
    # notice is always kept).
    new_application_email = models.BooleanField(default=True)
    campaign_weekly_report_email = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.recipient_id}:notification-preferences'


class EmployerNotification(models.Model):
    """Recruiter-facing website notification persisted with the domain transaction."""

    class EventType(models.TextChoices):
        VERIFICATION_APPROVED = (
            'verification_approved',
            gettext_lazy('Hồ sơ xác thực đã được duyệt'),
        )
        VERIFICATION_CHANGES_REQUESTED = (
            'verification_changes_requested',
            gettext_lazy('Hồ sơ xác thực cần bổ sung'),
        )
        VERIFICATION_REJECTED = 'verification_rejected', gettext_lazy('Hồ sơ xác thực bị từ chối')
        VERIFICATION_REVOKED = 'verification_revoked', gettext_lazy('Xác thực đã bị thu hồi')
        VERIFICATION_EXPIRED = 'verification_expired', gettext_lazy('Xác thực đã hết hiệu lực')
        DOCUMENT_CHANGES_REQUESTED = (
            'document_changes_requested',
            gettext_lazy('Giấy tờ xác thực cần bổ sung'),
        )
        DOCUMENT_REJECTED = 'document_rejected', gettext_lazy('Giấy tờ xác thực bị từ chối')
        COMPANY_LINK_REMOVED = 'company_link_removed', gettext_lazy('Liên kết công ty đã được gỡ')
        COMPANY_PAGE_EDITOR_GRANTED = (
            'company_page_editor_granted',
            gettext_lazy('Bạn được cấp quyền biên tập trang công ty'),
        )
        COMPANY_PAGE_EDITOR_REVOKED = (
            'company_page_editor_revoked',
            gettext_lazy('Quyền biên tập trang công ty đã bị thu hồi'),
        )
        COMPANY_CONTENT_REVERTED = (
            'company_content_reverted',
            gettext_lazy('Nội dung trang công ty đã bị hoàn tác'),
        )
        APPLICATION_RECEIVED = 'application_received', gettext_lazy('Có hồ sơ ứng tuyển mới')
        APPLICATION_WITHDRAWN = 'application_withdrawn', gettext_lazy('Ứng viên đã rút hồ sơ')
        APPLICATION_AWAITING_REPLY = (
            'application_awaiting_reply',
            gettext_lazy('Hồ sơ đang chờ phản hồi'),
        )
        JOB_CHANGES_REQUESTED = (
            'job_changes_requested',
            gettext_lazy('Tin tuyển dụng cần chỉnh sửa'),
        )
        COMPANY_JOIN_REQUESTED = (
            'company_join_requested',
            gettext_lazy('Có yêu cầu tham gia công ty'),
        )
        COMPANY_JOIN_APPROVED = (
            'company_join_approved',
            gettext_lazy('Yêu cầu tham gia công ty đã được duyệt'),
        )
        COMPANY_JOIN_REJECTED = (
            'company_join_rejected',
            gettext_lazy('Yêu cầu tham gia công ty bị từ chối'),
        )
        COMPANY_OWNERSHIP_CHANGED = (
            'company_ownership_changed',
            gettext_lazy('Quyền quản lý công ty đã thay đổi'),
        )
        JOBS_HANDED_OVER = 'jobs_handed_over', gettext_lazy('Tin tuyển dụng được giao lại')
        APPLICATION_REVIEW_SUBMITTED = (
            'application_review_submitted',
            gettext_lazy('Có đánh giá mới cho hồ sơ ứng viên'),
        )
        CAMPAIGN_ACTIVATED = (
            'campaign_activated',
            gettext_lazy('Chiến dịch đã được kích hoạt theo lịch'),
        )
        CAMPAIGN_ACTIVATION_FAILED = (
            'campaign_activation_failed',
            gettext_lazy('Chiến dịch chưa kích hoạt được theo lịch'),
        )
        CAMPAIGN_ENDING_SOON = (
            'campaign_ending_soon',
            gettext_lazy('Chiến dịch sắp đến ngày kết thúc'),
        )
        CAMPAIGN_AUTO_COMPLETED = (
            'campaign_auto_completed',
            gettext_lazy('Chiến dịch đã tự kết thúc'),
        )
        SOCIAL_POST_FAILED = 'social_post_failed', gettext_lazy('Tự đăng bài không thành công')
        SOCIAL_POST_DELETE_FAILED = (
            'social_post_delete_failed',
            gettext_lazy('Cần tự gỡ bài trên mạng xã hội'),
        )
        CAMPAIGN_HEALTH_ALERT = 'campaign_health_alert', gettext_lazy('Chiến dịch cần chú ý')
        SOCIAL_CONNECTION_EXPIRED = (
            'social_connection_expired',
            gettext_lazy('Kết nối mạng xã hội đã hết hạn'),
        )
        SOCIAL_CONNECTION_EXPIRING = (
            'social_connection_expiring',
            gettext_lazy('Kết nối mạng xã hội sắp hết hạn'),
        )

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employer_notifications',
    )
    event_type = models.CharField(max_length=48, choices=EventType.choices)
    dedupe_key = models.CharField(max_length=160)
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    action_path = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                name='uniq_employer_notice_recipient_dedupe',
            ),
        ]
        indexes = [
            models.Index(
                fields=['recipient', 'read_at', '-created_at'],
                name='emp_notice_unread_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('eno')
        super().save(*args, **kwargs)


class EmployerActivity(models.Model):
    """Privacy-safe recruiter activity retained independently from notification reads."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employer_activities',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=48, choices=EmployerNotification.EventType.choices)
    dedupe_key = models.CharField(max_length=160)
    summary = models.CharField(max_length=240)
    subject_public_id = models.CharField(max_length=50, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                name='uniq_employer_activity_recipient_dedupe',
            ),
        ]
        indexes = [
            models.Index(
                fields=['recipient', '-occurred_at'],
                name='emp_activity_user_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('eac')
        super().save(*args, **kwargs)
