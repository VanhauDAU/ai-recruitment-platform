"""Lịch hẹn phỏng vấn NTD đề xuất trong ProCV Connect, gắn hồ sơ ứng tuyển."""

from django.conf import settings
from django.db import models
from django.db.models import Q

from common.db.public_id import generate_public_id


class InterviewAppointment(models.Model):
    class Mode(models.TextChoices):
        ONSITE = 'onsite', 'Onsite'
        ONLINE = 'online', 'Online'
        PHONE = 'phone', 'Phone'

    class Status(models.TextChoices):
        PROPOSED = 'proposed', 'Proposed'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        RESCHEDULE_REQUESTED = 'reschedule_requested', 'Reschedule requested'
        CANCELLED = 'cancelled', 'Cancelled'
        SUPERSEDED = 'superseded', 'Superseded'

    # Lịch còn "mở": NTD đề xuất lại thì lịch cũ ở các trạng thái này bị thay.
    OPEN_STATUSES = (Status.PROPOSED, Status.RESCHEDULE_REQUESTED)

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    conversation = models.ForeignKey(
        'messaging.Conversation', on_delete=models.CASCADE, related_name='interviews'
    )
    application = models.ForeignKey(
        'applications.Application', on_delete=models.CASCADE, related_name='interviews'
    )
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    starts_at = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    mode = models.CharField(max_length=20, choices=Mode.choices)
    location = models.CharField(max_length=255, blank=True)
    meeting_url = models.URLField(max_length=500, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PROPOSED)
    candidate_note = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    reminded_24h_at = models.DateTimeField(null=True, blank=True)
    reminded_1h_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['application'],
                condition=Q(status='proposed'),
                name='uniq_open_interview_proposal',
            )
        ]
        indexes = [models.Index(fields=['status', 'starts_at'], name='interview_status_start_idx')]

    def __str__(self):
        return self.public_id

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('itv')
        super().save(*args, **kwargs)
