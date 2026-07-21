from django.db import models

from .core import Job, JobCategory


class JobCategoryAssignment(models.Model):
    """One primary specialization and optional domain knowledge tags."""

    class Role(models.TextChoices):
        PRIMARY_SPECIALIZATION = 'primary_specialization', 'Vị trí chuyên môn chính'
        DOMAIN_KNOWLEDGE = 'domain_knowledge', 'Kiến thức chuyên ngành'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='category_assignments')
    category = models.ForeignKey(
        JobCategory, on_delete=models.PROTECT, related_name='job_assignments'
    )
    role = models.CharField(max_length=30, choices=Role.choices)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'category', 'role'], name='uq_job_category_assignment'
            ),
            models.UniqueConstraint(
                fields=['job'],
                condition=models.Q(role='primary_specialization'),
                name='uq_job_primary_specialization',
            ),
        ]
        indexes = [models.Index(fields=['category', 'role', 'job'])]


class JobLocation(models.Model):
    """A workplace address; new writes require a ward, legacy province links are preserved."""

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_locations')
    location = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        related_name='job_workplaces',
    )
    address_detail = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'location', 'address_detail'], name='uq_job_location_address'
            ),
        ]
        indexes = [models.Index(fields=['location', 'job'])]


class JobWorkSchedule(models.Model):
    """One structured weekday/time range for a job posting."""

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='work_schedules')
    weekday_from = models.PositiveSmallIntegerField(null=True, blank=True)
    weekday_to = models.PositiveSmallIntegerField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_overnight = models.BooleanField(default=False)
    note = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.CheckConstraint(
                check=(models.Q(weekday_from__isnull=True) | models.Q(weekday_from__range=(1, 7))),
                name='chk_job_schedule_weekday_from',
            ),
            models.CheckConstraint(
                check=(models.Q(weekday_to__isnull=True) | models.Q(weekday_to__range=(1, 7))),
                name='chk_job_schedule_weekday_to',
            ),
        ]
