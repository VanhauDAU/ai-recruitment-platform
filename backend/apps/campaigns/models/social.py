from django.db import models

from common.public_id import generate_public_id


class SocialAccountConnection(models.Model):
    """A Facebook Page the recruiter connected; only its encrypted Page token is kept."""

    class Provider(models.TextChoices):
        FACEBOOK = 'facebook', 'Facebook'
        FAKE = 'fake', 'Giả lập'

    class Status(models.TextChoices):
        CONNECTED = 'connected', 'Đang kết nối'
        EXPIRED = 'expired', 'Hết hạn, cần kết nối lại'
        REVOKED = 'revoked', 'Đã ngắt kết nối'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    owner = models.ForeignKey(
        'employers.RecruiterProfile', on_delete=models.CASCADE, related_name='social_connections'
    )
    provider = models.CharField(max_length=20, choices=Provider.choices)
    page_id = models.CharField(max_length=64)
    page_name = models.CharField(max_length=255)
    page_picture_url = models.URLField(max_length=1000, blank=True)
    token_ciphertext = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CONNECTED)
    last_error_code = models.CharField(max_length=64, blank=True)
    connected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-connected_at']
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'provider', 'page_id'], name='camp_social_page_unique'
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('soc')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.provider}:{self.page_name}'


class ScheduledSocialPost(models.Model):
    """One post of a channel on a connected Page, published by Celery at its time."""

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Đã hẹn giờ'
        PUBLISHING = 'publishing', 'Đang đăng'
        PUBLISHED = 'published', 'Đã đăng'
        POSTPONED = 'postponed', 'Hoãn do chiến dịch tạm dừng'
        FAILED = 'failed', 'Đăng không thành công'
        CANCELLED = 'cancelled', 'Đã hủy'
        DELETED = 'deleted', 'Đã gỡ khỏi Fanpage'
        DELETE_FAILED = 'delete_failed', 'Chưa gỡ được khỏi Fanpage'

    OPEN_STATUSES = frozenset({Status.SCHEDULED, Status.POSTPONED, Status.FAILED})

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    channel = models.ForeignKey(
        'campaigns.CampaignChannel', on_delete=models.CASCADE, related_name='social_posts'
    )
    connection = models.ForeignKey(
        SocialAccountConnection, on_delete=models.CASCADE, related_name='posts'
    )
    message = models.TextField()
    link = models.URLField(max_length=500)
    # Public-media storage keys of attached images, in display order.
    images = models.JSONField(default=list, blank=True)
    scheduled_for = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    last_error_code = models.CharField(max_length=64, blank=True)
    external_post_id = models.CharField(max_length=128, blank=True)
    permalink = models.URLField(max_length=1000, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_for', '-id']
        indexes = [
            models.Index(fields=['status', 'next_attempt_at'], name='camp_post_due_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('post')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.channel_id}:{self.status}'
