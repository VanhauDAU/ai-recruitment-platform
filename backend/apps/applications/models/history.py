from django.conf import settings
from django.db import models


class ApplicationStatusHistory(models.Model):
    """One status change of an application, the audit trail of every decision.

    A recruiter decision also schedules one candidate notification whose
    ``dedupe_key`` is ``notification_key``. The key is defined here, on the
    model, because both the services that emit the notification and the
    selectors that read its delivery state need it, and services and selectors
    may not import each other.
    """

    NOTIFICATION_KEY_PREFIX = 'application-status:'

    application = models.ForeignKey(
        'applications.Application', on_delete=models.CASCADE, related_name='status_history'
    )
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    # Internal only: never shown to the candidate.
    note = models.TextField(blank=True)
    # Set when the recruiter undoes this change before the candidate was told.
    reverted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['application', 'created_at'], name='app_status_history_idx')
        ]

    @property
    def notification_key(self):
        return f'{self.NOTIFICATION_KEY_PREFIX}{self.pk}'
