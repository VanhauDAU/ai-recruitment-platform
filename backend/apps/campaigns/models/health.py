from django.db import models


class CampaignHealthSnapshot(models.Model):
    """Health of a campaign on one Vietnam calendar day, kept for trends and alerts.

    ``open_alerts`` maps each failing rule to ``{'since': date, 'notified': date}``
    so an alert is sent when a rule starts failing and repeated at most weekly.
    """

    class Status(models.TextChoices):
        ACHIEVED = 'achieved', 'Đã đủ chỉ tiêu'
        ON_TRACK = 'on_track', 'Đúng tiến độ'
        AT_RISK = 'at_risk', 'Có nguy cơ chậm'
        OFF_TRACK = 'off_track', 'Đang chậm'
        INSUFFICIENT_DATA = 'insufficient_data', 'Chưa đủ dữ liệu'
        NO_TARGET = 'no_target', 'Chưa có chỉ tiêu'

    campaign = models.ForeignKey(
        'campaigns.RecruitmentCampaign', on_delete=models.CASCADE, related_name='health_snapshots'
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices)
    metrics = models.JSONField(default=dict)
    open_alerts = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        constraints = [
            models.UniqueConstraint(fields=['campaign', 'date'], name='camp_health_day_unique'),
        ]

    def __str__(self):
        return f'{self.campaign_id}:{self.date}:{self.status}'


class CampaignReportDelivery(models.Model):
    """One weekly report email per campaign and week, so reruns never send twice."""

    campaign = models.ForeignKey(
        'campaigns.RecruitmentCampaign', on_delete=models.CASCADE, related_name='report_deliveries'
    )
    week_start = models.DateField()
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'week_start'], name='camp_report_week_unique'
            ),
        ]

    def __str__(self):
        return f'{self.campaign_id}:{self.week_start}'
