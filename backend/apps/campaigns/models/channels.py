import secrets
import string

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id

CODE_ALPHABET = string.ascii_letters + string.digits
CODE_LENGTH = 8


def generate_channel_code():
    return ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


class CampaignChannel(models.Model):
    """One place a campaign is distributed (a Fanpage, a group...), with tracked links.

    Every link of the channel shares its ``code``: ``/r/<code>`` opens the campaign
    landing page, ``/r/<code>/<job public_id>`` one job and ``/r/<code>/cong-ty``
    the company page. Each click is counted for the channel and carries a signed
    reference to the application form, so every application is credited to it.

    ``target`` and ``jobs`` describe the post being drafted for the channel: which
    jobs it advertises and where its links lead. They change from post to post;
    the channel itself is not tied to one job.
    """

    class Kind(models.TextChoices):
        FACEBOOK_PAGE = 'facebook_page', gettext_lazy('Fanpage Facebook')
        FACEBOOK_GROUP = 'facebook_group', gettext_lazy('Nhóm Facebook')
        INSTAGRAM = 'instagram', 'Instagram'
        LINKEDIN = 'linkedin', 'LinkedIn'
        ZALO = 'zalo', 'Zalo'
        TIKTOK = 'tiktok', 'TikTok'
        EMAIL = 'email', 'Email'
        WEBSITE = 'website', gettext_lazy('Website công ty')
        QR_OFFLINE = 'qr_offline', gettext_lazy('Tờ rơi / QR')
        OTHER = 'other', gettext_lazy('Kênh khác')

    class Target(models.TextChoices):
        LANDING = 'landing', gettext_lazy('Trang tuyển dụng của chiến dịch')
        JOB = 'job', gettext_lazy('Link riêng từng tin')
        COMPANY = 'company', gettext_lazy('Trang công ty')

    class ContentSource(models.TextChoices):
        NONE = '', gettext_lazy('Chưa có')
        AI = 'ai', gettext_lazy('AI soạn')
        TEMPLATE = 'template', gettext_lazy('Mẫu có sẵn')
        MANUAL = 'manual', gettext_lazy('Tự soạn')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    campaign = models.ForeignKey(
        'campaigns.RecruitmentCampaign', on_delete=models.CASCADE, related_name='channels'
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    label = models.CharField(max_length=120)
    code = models.CharField(max_length=16, unique=True, default=generate_channel_code)
    target = models.CharField(max_length=10, choices=Target.choices, default=Target.LANDING)
    # Jobs the current post advertises; empty means every open job of the campaign.
    jobs = models.ManyToManyField('jobs.Job', blank=True, related_name='campaign_channels')
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
        ]

    def __str__(self):
        return f'{self.campaign_id}:{self.label}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('chn')
        super().save(*args, **kwargs)


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
