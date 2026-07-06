from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


class Application(models.Model):
    """A candidate's application to a job (DB doc section 2.15).

    One candidate can only apply to a given job once — UNIQUE(candidate, job).
    Re-applying after rejection is handled by updating cv_id/status on the
    existing row, not by creating a new application.
    """

    class Source(models.TextChoices):
        APPLIED = 'applied', 'Applied'
        RECOMMENDED = 'recommended', 'Recommended'
        INVITED = 'invited', 'Invited'

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted'
        VIEWED = 'viewed', 'Viewed'
        SHORTLISTED = 'shortlisted', 'Shortlisted'
        INTERVIEWED = 'interviewed', 'Interviewed'
        REJECTED = 'rejected', 'Rejected'
        ACCEPTED = 'accepted', 'Accepted'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    candidate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='applications')
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='applications')
    cv = models.ForeignKey('cvs.UserCv', on_delete=models.PROTECT, related_name='applications')
    cover_letter = models.TextField(blank=True)
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.APPLIED)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.SUBMITTED)
    employer_note = models.TextField(blank=True)
    candidate_note = models.TextField(blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    shortlisted_at = models.DateTimeField(null=True, blank=True)
    interviewed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'job'], name='uq_applications_candidate_job'),
            models.CheckConstraint(
                check=models.Q(status__in=['submitted', 'viewed', 'shortlisted', 'interviewed', 'rejected', 'accepted']),
                name='chk_applications_status',
            ),
        ]
        indexes = [
            models.Index(fields=['candidate']),
            models.Index(fields=['job']),
            models.Index(fields=['status']),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('app')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.candidate.email} -> {self.job.title}'
