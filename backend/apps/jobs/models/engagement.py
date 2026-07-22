"""Aggregated, privacy-safe job engagement counters."""

from django.db import models


class JobEngagementDaily(models.Model):
    """Daily counters without storing raw viewers or individual events."""

    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.CASCADE,
        related_name='daily_engagement',
    )
    date = models.DateField()
    impression_count = models.PositiveIntegerField(default=0)
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'date'],
                name='jobs_unique_daily_engagement',
            ),
        ]
        indexes = [
            models.Index(fields=['job', 'date'], name='jobs_engagement_job_date_idx'),
        ]
        ordering = ['date']

    def __str__(self):
        return f'{self.job_id} - {self.date}'
