from django.conf import settings
from django.db import models

from .core import Job


class CandidateHiddenJob(models.Model):
    """A job explicitly dismissed from one candidate's personalized surfaces."""

    class Source(models.TextChoices):
        MATCHING = 'matching', 'Việc làm phù hợp'
        HOMEPAGE = 'homepage', 'Trang chủ'
        INLINE = 'inline', 'Danh sách việc làm'

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hidden_recommended_jobs',
    )
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name='hidden_by_candidates',
    )
    source = models.CharField(max_length=20, choices=Source.choices)
    hidden_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'candidate_hidden_jobs'
        ordering = ['-hidden_at', '-pk']
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'job'],
                name='uq_candidate_hidden_job',
            ),
        ]
        indexes = [
            models.Index(
                fields=['candidate', '-hidden_at'],
                name='jobs_hidden_candidate_idx',
            ),
        ]

    def __str__(self):
        return f'{self.candidate_id} - {self.job_id}'
