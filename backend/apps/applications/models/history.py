from django.conf import settings
from django.db import models


class ApplicationStatusHistory(models.Model):
    application = models.ForeignKey(
        'applications.Application', on_delete=models.CASCADE, related_name='status_history'
    )
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['application', 'created_at'], name='app_status_history_idx')
        ]
