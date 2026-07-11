from django.conf import settings
from django.db import models

from .core import Job


class SavedJob(models.Model):
    """Tin ứng viên bấm lưu (nút trái tim trên job card, panel "Việc làm đã lưu")."""

    candidate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_jobs')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='saved_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'job'], name='uq_saved_jobs_candidate_job'),
        ]
        indexes = [
            models.Index(fields=['candidate', '-created_at']),
        ]

    def __str__(self):
        return f'{self.candidate_id} - {self.job_id}'

