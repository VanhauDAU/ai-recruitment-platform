"""Structured content of the public company page that goes through moderation.

Rows here only change when an admin approves a company update request
(``services.companies.apply_update_request``), like the ``Company`` columns.
"""

from django.db import models

from common.public_id import generate_public_id

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

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cof')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.company_id}: {self.label}'
