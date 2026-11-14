"""Candidates following a public company page."""

from django.conf import settings
from django.db import models

from .company import Company


class CompanyFollow(models.Model):
    """One candidate following one company.

    ``Company.follower_count`` mirrors the number of rows per company: the
    follow service increments it and ``employers.signals`` decrements it.
    """

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='company_follows',
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='follows')
    notify_new_jobs = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'company'],
                name='emp_co_follow_unique',
            ),
        ]
        indexes = [
            models.Index(
                fields=['candidate', '-created_at'],
                name='emp_co_follow_candidate_idx',
            ),
        ]

    def __str__(self):
        return f'{self.candidate_id} - {self.company_id}'
