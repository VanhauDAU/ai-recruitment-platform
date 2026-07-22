from django.conf import settings
from django.db import models


class JobStatusHistory(models.Model):
    class ActorRole(models.TextChoices):
        EMPLOYER = 'employer', 'Nhà tuyển dụng'
        ADMIN = 'admin', 'Quản trị viên'
        SYSTEM = 'system', 'Hệ thống'

    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    actor_role = models.CharField(max_length=20, choices=ActorRole.choices)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['job', '-created_at'], name='job_status_history_idx')]
