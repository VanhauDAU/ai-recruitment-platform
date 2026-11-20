from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id

from ..domain.social_networks import NETWORK_CHOICES, NETWORKS


class SocialAccountConnection(models.Model):
    """An account the recruiter connected on a social network (a Facebook Page, ...).

    Only the account's own token is kept, encrypted. ``simulated`` marks a
    connection made through the fake provider of a network that is not live.
    """

    class Status(models.TextChoices):
        CONNECTED = 'connected', gettext_lazy('Đang kết nối')
        EXPIRED = 'expired', gettext_lazy('Hết hạn, cần kết nối lại')
        REVOKED = 'revoked', gettext_lazy('Đã ngắt kết nối')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    owner = models.ForeignKey(
        'employers.RecruiterProfile', on_delete=models.CASCADE, related_name='social_connections'
    )
    network = models.CharField(max_length=20, choices=NETWORK_CHOICES)
    simulated = models.BooleanField(default=False)
    account_id = models.CharField(max_length=64)
    account_name = models.CharField(max_length=255)
    account_picture_url = models.URLField(max_length=1000, blank=True)
    token_ciphertext = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CONNECTED)
    last_error_code = models.CharField(max_length=64, blank=True)
    connected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-connected_at']
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'network', 'simulated', 'account_id'],
                name='camp_social_account_unique',
            ),
        ]

    def __str__(self):
        return f'{self.network}:{self.account_name}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('soc')
        super().save(*args, **kwargs)

    @property
    def spec(self):
        return NETWORKS[self.network]


class ScheduledSocialPost(models.Model):
    """One post of a channel on a connected account, published by Celery at its time."""

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', gettext_lazy('Đã hẹn giờ')
        PUBLISHING = 'publishing', gettext_lazy('Đang đăng')
        PUBLISHED = 'published', gettext_lazy('Đã đăng')
        POSTPONED = 'postponed', gettext_lazy('Hoãn do chiến dịch tạm dừng')
        FAILED = 'failed', gettext_lazy('Đăng không thành công')
        CANCELLED = 'cancelled', gettext_lazy('Đã hủy')
        DELETED = 'deleted', gettext_lazy('Đã gỡ bài')
        DELETE_FAILED = 'delete_failed', gettext_lazy('Cần tự gỡ bài')

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

    def __str__(self):
        return f'{self.channel_id}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('post')
        super().save(*args, **kwargs)
