from django.conf import settings
from django.db import models
from django.db.models import CharField, Exists, OuterRef, Value
from django.db.models.functions import Cast, Concat

NOTIFICATION_KEY_PREFIX = 'application-status:'


class ApplicationStatusHistoryQuerySet(models.QuerySet):
    def published(self):
        """Rows the candidate has been told about.

        Undone rows and rows whose notice is still waiting (the recruiter's undo
        window, or the grace period of an automatic rejection) stay private.
        """
        from apps.candidates.models import CandidateNotification

        pending_notice = CandidateNotification.objects.filter(
            recipient_id=OuterRef('application__candidate_id'),
            dedupe_key=Concat(Value(NOTIFICATION_KEY_PREFIX), Cast(OuterRef('pk'), CharField())),
            delivered_at__isnull=True,
        )
        return self.filter(reverted_at__isnull=True).exclude(Exists(pending_notice))


class ApplicationStatusHistory(models.Model):
    """One status change of an application, the audit trail of every decision.

    A recruiter decision also schedules one candidate notification whose
    ``dedupe_key`` is ``notification_key``. The key is defined here, on the
    model, because both the services that emit the notification and the
    selectors that read its delivery state need it, and services and selectors
    may not import each other.
    """

    NOTIFICATION_KEY_PREFIX = NOTIFICATION_KEY_PREFIX

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

    objects = ApplicationStatusHistoryQuerySet.as_manager()

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['application', 'created_at'], name='app_status_history_idx')
        ]

    def __str__(self):
        return f'{self.application_id}: {self.from_status} → {self.to_status}'

    @property
    def notification_key(self):
        return f'{self.NOTIFICATION_KEY_PREFIX}{self.pk}'
