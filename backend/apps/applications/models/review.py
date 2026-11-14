from django.conf import settings
from django.db import models
from django.db.models import Q

from common.public_id import generate_public_id


class ApplicationReviewLink(models.Model):
    """A revocable bearer link letting someone outside the recruiter's account
    (e.g. a hiring manager) read one application's CV and leave a scorecard.

    Only the SHA-256 of the token is stored; the raw token exists solely in the
    create response. Reviewers see a de-identified CV (no photo or contacts).
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    application = models.ForeignKey(
        'applications.Application', on_delete=models.CASCADE, related_name='review_links'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    reviewer_name = models.CharField(max_length=120)
    message = models.TextField(blank=True)
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_opened_at = models.DateTimeField(null=True, blank=True)
    open_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['application', '-created_at'], name='app_review_link_app_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('arl')
        super().save(*args, **kwargs)


class ApplicationReview(models.Model):
    """The scorecard a reviewer submits through one link (editable until expiry)."""

    class Recommendation(models.TextChoices):
        STRONG_YES = 'strong_yes', 'Rất nên tuyển'
        YES = 'yes', 'Nên tuyển'
        NO = 'no', 'Chưa nên tuyển'
        STRONG_NO = 'strong_no', 'Không nên tuyển'

    link = models.OneToOneField(
        ApplicationReviewLink, on_delete=models.CASCADE, related_name='review'
    )
    application = models.ForeignKey(
        'applications.Application', on_delete=models.CASCADE, related_name='reviews'
    )
    recommendation = models.CharField(max_length=20, choices=Recommendation.choices)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    strengths = models.TextField(blank=True)
    concerns = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(rating__isnull=True) | Q(rating__gte=1, rating__lte=5),
                name='chk_application_review_rating',
            ),
        ]
