from django.conf import settings
from django.db import models
from django.utils import timezone

from common.public_id import generate_public_id


class Application(models.Model):
    """A candidate's application to a job (DB doc section 2.15).

    A candidate has at most one *current* application per job, the one the
    recruiter works on; earlier submissions stay as read-only history
    (``is_current=False``) with their own immutable CV snapshot. A new
    submission is only allowed once the current one was rejected or withdrawn.
    """

    class Source(models.TextChoices):
        APPLIED = 'applied', 'Applied'
        RECOMMENDED = 'recommended', 'Recommended'
        INVITED = 'invited', 'Invited'

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Mới'
        VIEWED = 'viewed', 'Đã xem'
        SHORTLISTED = 'shortlisted', 'Phù hợp'
        INTERVIEWED = 'interviewed', 'Phỏng vấn'
        REJECTED = 'rejected', 'Không phù hợp'
        ACCEPTED = 'accepted', 'Trúng tuyển'
        WITHDRAWN = 'withdrawn', 'Đã rút'

    # Statuses the recruiter has not answered yet. One definition shared by the
    # `scope=unanswered` filter, automatic rejection and every aggregate that
    # reports this number.
    UNANSWERED_STATUSES = (Status.SUBMITTED, Status.VIEWED)
    # `submitted` and `viewed` are facts recorded by the system; a recruiter
    # can only answer with one of these decisions.
    DECISION_STATUSES = (
        Status.SHORTLISTED,
        Status.INTERVIEWED,
        Status.ACCEPTED,
        Status.REJECTED,
    )
    TERMINAL_STATUSES = (Status.ACCEPTED, Status.REJECTED, Status.WITHDRAWN)
    # The candidate may submit again only after one of these outcomes.
    REAPPLY_ALLOWED_STATUSES = (Status.REJECTED, Status.WITHDRAWN)

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
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    is_current = models.BooleanField(default=True)
    status_updated_at = models.DateTimeField(default=timezone.now)
    auto_rejection_reminder_sent_at = models.DateTimeField(null=True, blank=True)
    auto_rejected_at = models.DateTimeField(null=True, blank=True)
    auto_rejection_email_sent_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    status__in=[
                        'submitted',
                        'viewed',
                        'shortlisted',
                        'interviewed',
                        'rejected',
                        'accepted',
                        'withdrawn',
                    ]
                ),
                name='chk_applications_status',
            ),
            models.UniqueConstraint(
                fields=['candidate', 'job'],
                condition=models.Q(is_current=True),
                name='uniq_app_current_per_candidate_job',
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
            models.Index(
                fields=['status', 'status_updated_at'],
                name='app_auto_status_due_idx',
            ),
            models.Index(fields=['submitted_cv_version'], name='idx_app_submitted_cv_version'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('app')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.candidate.email} -> {self.job.title}'
