from django.db import models

from common.public_id import generate_public_id

from .choices import BudgetSource, PositionLevel


class RecruitmentCampaign(models.Model):
    """A recruiter-owned grouping for jobs and their application funnel.

    A company remains the legal publisher of a job, but it deliberately does
    not grant access to a campaign. The owning recruiter is the sole tenant.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        ACTIVE = 'active', 'Đang chạy'
        PAUSED = 'paused', 'Tạm dừng'
        COMPLETED = 'completed', 'Hoàn tất'
        CANCELLED = 'cancelled', 'Đã hủy'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        'employers.Company',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='recruitment_campaigns',
    )
    owner = models.ForeignKey(
        'employers.RecruiterProfile', on_delete=models.CASCADE, related_name='campaigns'
    )
    source_need = models.ForeignKey(
        'employers.RecruitmentNeed',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='campaigns',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    position_category = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.PROTECT,
        related_name='recruitment_campaigns',
        null=True,
        blank=True,
    )
    position_level = models.CharField(max_length=30, choices=PositionLevel.choices, blank=True)
    headcount_target = models.PositiveIntegerField(default=1)
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    is_continuous = models.BooleanField(default=False)
    budget_min = models.PositiveBigIntegerField(null=True, blank=True)
    budget_max = models.PositiveBigIntegerField(null=True, blank=True)
    budget_source = models.CharField(
        max_length=20, choices=BudgetSource.choices, default=BudgetSource.COMPANY
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['owner', 'status', '-created_at'], name='emp_camp_owner_status_idx'
            ),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('camp')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
