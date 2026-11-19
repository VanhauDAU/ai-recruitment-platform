from django.conf import settings
from django.db import models
from django.db.models import Q

from common.db.public_id import generate_public_id


class CandidateNotification(models.Model):
    """One candidate-facing notice: the inbox item and its email outbox row.

    A notice may be scheduled for later (``deliver_after``) so the recruiter
    keeps a short window to undo a decision. Until ``delivered_at`` is set the
    candidate sees nothing; a newer notice with the same ``supersede_key`` or an
    undo cancels it instead. Release and cancellation are both one conditional
    UPDATE on the same predicate, so PostgreSQL decides who wins a race.
    """

    class EventType(models.TextChoices):
        APPLICATION_SUBMITTED = 'application_submitted', 'Hồ sơ đã được tiếp nhận'
        APPLICATION_VIEWED = 'application_viewed', 'Nhà tuyển dụng đã xem hồ sơ'
        APPLICATION_CV_DOWNLOADED = 'application_cv_downloaded', 'Nhà tuyển dụng đã tải CV'
        APPLICATION_SHORTLISTED = 'application_shortlisted', 'Hồ sơ phù hợp'
        APPLICATION_INTERVIEWED = 'application_interviewed', 'Mời phỏng vấn'
        APPLICATION_ACCEPTED = 'application_accepted', 'Trúng tuyển'
        APPLICATION_REJECTED = 'application_rejected', 'Chưa phù hợp'
        TALENT_POOL_SAVED = 'talent_pool_saved', 'Được lưu vào kho ứng viên tiềm năng'
        JOB_INVITATION = 'job_invitation', 'Lời mời ứng tuyển'

    class CancelReason(models.TextChoices):
        SUPERSEDED = 'superseded', 'Bị thay bằng thông báo mới hơn'
        UNDONE = 'undone', 'Nhà tuyển dụng hoàn tác'

    class EmailStatus(models.TextChoices):
        PENDING = 'pending', 'Chờ gửi'
        SENDING = 'sending', 'Đang gửi'
        SENT = 'sent', 'Đã gửi'
        FAILED = 'failed', 'Gửi lỗi'
        SKIPPED = 'skipped', 'Không gửi'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='candidate_notifications',
    )
    event_type = models.CharField(max_length=48, choices=EventType.choices)
    dedupe_key = models.CharField(max_length=160)
    supersede_key = models.CharField(max_length=160, blank=True)
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    action_path = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    # False when the candidate turned the website channel off for this event:
    # the row still exists as the email outbox but never reaches the bell.
    show_in_inbox = models.BooleanField(default=True)
    deliver_after = models.DateTimeField()
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=20, choices=CancelReason.choices, blank=True)
    email_status = models.CharField(
        max_length=20, choices=EmailStatus.choices, default=EmailStatus.PENDING
    )
    email_attempts = models.PositiveSmallIntegerField(default=0)
    email_started_at = models.DateTimeField(null=True, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    email_last_error = models.TextField(blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                name='uniq_candidate_notice_dedupe',
            ),
            models.CheckConstraint(
                condition=Q(delivered_at__isnull=True) | Q(cancelled_at__isnull=True),
                name='chk_candidate_notice_delivered_xor_cancelled',
            ),
        ]
        indexes = [
            models.Index(
                fields=['deliver_after'],
                name='cand_notice_due_idx',
                condition=Q(delivered_at__isnull=True, cancelled_at__isnull=True),
            ),
            models.Index(
                fields=['recipient', '-delivered_at'],
                name='cand_notice_inbox_idx',
                condition=Q(delivered_at__isnull=False, show_in_inbox=True),
            ),
            models.Index(
                fields=['recipient'],
                name='cand_notice_unread_idx',
                condition=Q(delivered_at__isnull=False, show_in_inbox=True, read_at__isnull=True),
            ),
            models.Index(
                fields=['email_status'],
                name='cand_notice_email_queue_idx',
                condition=Q(delivered_at__isnull=False, email_status__in=['pending', 'sending']),
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cno')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'CandidateNotification<{self.recipient_id}:{self.event_type}>'
