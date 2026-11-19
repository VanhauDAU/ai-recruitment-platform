"""Structured content of the public company page and its post-moderation log.

Benefits and offices change when a page editor publishes them
(``services.company_content_changes``) or when an admin approves a company
update request (``services.company_update_review.apply_update_request``).
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id

from .company import Company


class CompanyBenefit(models.Model):
    """A catalogue benefit the company offers, with an optional short note."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='benefit_items')
    benefit = models.ForeignKey(
        'jobs.Benefit',
        on_delete=models.PROTECT,
        related_name='company_assignments',
    )
    note = models.CharField(max_length=160, blank=True)
    sort_order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['company', 'benefit'], name='emp_co_benefit_unique'),
        ]

    def __str__(self):
        return f'{self.company_id}: {self.benefit_id}'


class CompanyOffice(models.Model):
    """One office shown on the page; never backfilled from ``Company.address``."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='offices')
    label = models.CharField(max_length=120)
    address_line = models.CharField(max_length=255)
    # A province-level Location, which job filters and JSON-LD rely on.
    province = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        related_name='+',
    )
    is_headquarters = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['company'],
                condition=models.Q(is_headquarters=True),
                name='emp_co_office_one_hq',
            ),
        ]

    def __str__(self):
        return f'{self.company_id}: {self.label}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cof')
        super().save(*args, **kwargs)


class CompanyContentChange(models.Model):
    """One publish of page content by an editor, kept for review afterwards.

    ``changes`` holds what was published and ``previous`` what it replaced, in
    the shapes update requests store (storage paths for media; gallery rows as
    ``{id, image_url, caption, sort_order}``). Files a change replaced stay on
    disk until the change is reviewed, so a revert can put them back.
    """

    class Status(models.TextChoices):
        UNREVIEWED = 'unreviewed', gettext_lazy('Chưa xem')
        REVIEWED = 'reviewed', gettext_lazy('Đã xem')
        REVERTED = 'reverted', gettext_lazy('Đã hoàn tác')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='content_changes')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    changes = models.JSONField(default=dict)
    previous = models.JSONField(default=dict)
    # Media kinds (``logo``/``cover``/``gallery``) announced but not uploaded yet.
    pending_media = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UNREVIEWED)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='emp_co_content_change_idx'),
            models.Index(fields=['company', '-created_at'], name='emp_co_content_change_co_idx'),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cch')
        super().save(*args, **kwargs)
