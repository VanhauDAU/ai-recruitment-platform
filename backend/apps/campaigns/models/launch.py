from django.conf import settings
from django.db import models


class CampaignLaunchPlan(models.Model):
    """What a campaign will do when it goes live, now or on its start date.

    A scheduled activation runs without the recruiter at the keyboard, so the
    responsibility statement they accepted when scheduling is kept here and
    re-checked against the version in force on the day.
    """

    campaign = models.OneToOneField(
        'campaigns.RecruitmentCampaign',
        on_delete=models.CASCADE,
        related_name='launch_plan',
    )
    accepted_statement_version = models.CharField(max_length=20, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    last_error = models.JSONField(default=dict, blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'launch:{self.campaign_id}'


class CampaignLaunchJob(models.Model):
    """One job the launch will publish (a campaign draft) or attach (already public)."""

    class Action(models.TextChoices):
        PUBLISH = 'publish', 'Đăng tin nháp'
        ATTACH = 'attach', 'Gắn tin đang hiển thị'

    plan = models.ForeignKey(CampaignLaunchPlan, on_delete=models.CASCADE, related_name='jobs')
    job = models.ForeignKey(
        'jobs.Job', on_delete=models.CASCADE, related_name='campaign_launch_entries'
    )
    action = models.CharField(max_length=10, choices=Action.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['plan', 'job'], name='camp_launch_job_unique'),
        ]

    def __str__(self):
        return f'{self.plan_id}:{self.action}:{self.job_id}'
