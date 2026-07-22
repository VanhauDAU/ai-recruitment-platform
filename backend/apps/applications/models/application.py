from django.conf import settings
from django.db import models

from common.public_id import generate_public_id


class Application(models.Model):
    """A candidate's application to a job (DB doc section 2.15).

    A candidate may submit up to three applications to one job. Each submission
    keeps its own immutable CV snapshot so recruiters can review every version.
    """

    class Source(models.TextChoices):
        APPLIED = 'applied', 'Applied'
        RECOMMENDED = 'recommended', 'Recommended'
        INVITED = 'invited', 'Invited'

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted'
        VIEWED = 'viewed', 'Viewed'
        CONSIDERING = 'considering', 'Considering'
        SHORTLISTED = 'shortlisted', 'Shortlisted'
        INTERVIEWED = 'interviewed', 'Interviewed'
        REJECTED = 'rejected', 'Rejected'
        ACCEPTED = 'accepted', 'Accepted'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='applications'
    )
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='applications')
    cv = models.ForeignKey(
        'cvs.UserCv',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='applications',
    )
    # `cv` is a library pointer only. It becomes NULL when a candidate
    # permanently deletes that CV; recruiter reads always use the immutable
    # submitted snapshot below.
    submitted_cv_version = models.ForeignKey(
        'cvs.CvVersion',
        on_delete=models.PROTECT,
        related_name='submitted_applications',
    )
    submitted_cv_title = models.CharField(max_length=255, default='')
    submitted_cv_source = models.CharField(max_length=30, default='builder')
    submitted_at = models.DateTimeField(null=True, blank=True)
    cover_letter = models.TextField(blank=True)
    preferred_locations = models.ManyToManyField(
        'locations.Location',
        blank=True,
        related_name='applications',
    )
    contact_name = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    allow_ai_analysis = models.BooleanField(default=False)
    data_processing_consent = models.BooleanField(default=False)
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.APPLIED)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.SUBMITTED)
    employer_note = models.TextField(blank=True)
    employer_rating = models.PositiveSmallIntegerField(null=True, blank=True)
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
            models.CheckConstraint(
                check=models.Q(
                    status__in=[
                        'submitted',
                        'viewed',
                        'considering',
                        'shortlisted',
                        'interviewed',
                        'rejected',
                        'accepted',
                    ]
                ),
                name='chk_applications_status',
            ),
        ]
        indexes = [
            models.Index(fields=['candidate']),
            models.Index(
                fields=['candidate', 'job', 'applied_at'],
                name='idx_app_candidate_job_date',
            ),
            models.Index(fields=['job']),
            models.Index(fields=['status']),
            models.Index(fields=['submitted_cv_version'], name='idx_app_submitted_cv_version'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('app')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.candidate.email} -> {self.job.title}'
