import secrets
import string

from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

CODE_ALPHABET = string.ascii_letters + string.digits
CODE_LENGTH = 8


def generate_channel_code():
    return ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


class CampaignChannel(models.Model):
    """One place a campaign is distributed, with its own tracked short link.

    The link ``/r/<code>`` counts clicks and carries a signed reference to the
    application form, so every application can be credited to the channel that
    brought the candidate.
    """

    class Kind(models.TextChoices):
        FACEBOOK_PAGE = 'facebook_page', 'Fanpage Facebook'
        FACEBOOK_GROUP = 'facebook_group', 'Nhóm Facebook'
        LINKEDIN = 'linkedin', 'LinkedIn'
        ZALO = 'zalo', 'Zalo'
        TIKTOK = 'tiktok', 'TikTok'
        EMAIL = 'email', 'Email'
        WEBSITE = 'website', 'Website công ty'
        QR_OFFLINE = 'qr_offline', 'Tờ rơi / QR'
        OTHER = 'other', 'Kênh khác'

    class Target(models.TextChoices):
        LANDING = 'landing', 'Trang tuyển dụng của chiến dịch'
        JOB = 'job', 'Một tin tuyển dụng'

    class ContentSource(models.TextChoices):
        NONE = '', 'Chưa có'
        AI = 'ai', 'AI soạn'
        TEMPLATE = 'template', 'Mẫu có sẵn'
        MANUAL = 'manual', 'Tự soạn'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    campaign = models.ForeignKey(
        'employers.RecruitmentCampaign', on_delete=models.CASCADE, related_name='channels'
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    label = models.CharField(max_length=120)
    code = models.CharField(max_length=16, unique=True, default=generate_channel_code)
    target = models.CharField(max_length=10, choices=Target.choices, default=Target.LANDING)
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='campaign_channels',
    )
    content = models.JSONField(default=dict, blank=True)
    content_source = models.CharField(
        max_length=10, choices=ContentSource.choices, default=ContentSource.NONE, blank=True
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_url = models.URLField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at', 'id']
        constraints = [
            models.UniqueConstraint(fields=['campaign', 'label'], name='camp_channel_label_unique'),
            models.CheckConstraint(
                condition=models.Q(target='landing') | models.Q(job__isnull=False),
                name='camp_channel_job_target',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('chn')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.campaign_id}:{self.label}'


class CampaignChannelCost(models.Model):
    """Money the recruiter spent on one channel (ads, printing...); entered by hand."""

    channel = models.ForeignKey(CampaignChannel, on_delete=models.CASCADE, related_name='costs')
    amount = models.PositiveBigIntegerField()
    incurred_on = models.DateField()
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-incurred_on', '-id']

    def __str__(self):
        return f'{self.channel_id}:{self.amount}'


class CampaignChannelClickDaily(models.Model):
    """Aggregate clicks per channel and Vietnam calendar day; no visitor identity."""

    channel = models.ForeignKey(
        CampaignChannel, on_delete=models.CASCADE, related_name='daily_clicks'
    )
    date = models.DateField()
    click_count = models.PositiveIntegerField(default=0)
    unique_click_count = models.PositiveIntegerField(default=0)
    preview_count = models.PositiveIntegerField(default=0)
    inactive_click_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['channel', 'date'], name='camp_channel_click_day'),
        ]

    def __str__(self):
        return f'{self.channel_id}:{self.date}'
