from django.db import models
from django.utils.translation import gettext_lazy

from .categories import JobCategory
from .core import Job


class JobCategoryAssignment(models.Model):
    """One primary specialization and optional domain knowledge tags."""

    class Role(models.TextChoices):
        PRIMARY_SPECIALIZATION = 'primary_specialization', gettext_lazy('Vị trí chuyên môn chính')
        DOMAIN_KNOWLEDGE = 'domain_knowledge', gettext_lazy('Kiến thức chuyên ngành')

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

    def __str__(self):
        return f'{self.job_id}: {self.category_id} ({self.role})'


class JobLocation(models.Model):
    """A workplace address; new writes require a ward, legacy province links are preserved.

    Coordinates (ADR-0029) come from the employer's pin, a geocoded address or the
    ward centroid; a province-wide row ("Tất cả") has none. Set by
    ``services.coordinates`` whenever the rows are (re)written.
    """

    class Precision(models.TextChoices):
        EXACT = 'exact', 'Exact address'
        WARD = 'ward', 'Ward centroid'
        PROVINCE = 'province', 'Whole province'

    class CoordinateSource(models.TextChoices):
        EMPLOYER_PIN = 'employer_pin', 'Employer pin'
        GEOCODER = 'geocoder', 'Geocoded address'
        WARD_CENTROID = 'ward_centroid', 'Ward centroid'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_locations')
    location = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        related_name='job_workplaces',
    )
    address_detail = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    coordinate_precision = models.CharField(max_length=20, choices=Precision.choices, blank=True)
    coordinate_source = models.CharField(
        max_length=20, choices=CoordinateSource.choices, blank=True
    )
    # Địa chỉ chi tiết chưa có trong GeocodeCache: tạm dùng tâm phường, Celery geocode sau.
    geocode_pending = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'location', 'address_detail'], name='uq_job_location_address'
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(latitude__isnull=True, longitude__isnull=True)
                    | models.Q(
                        latitude__gte=-90, latitude__lte=90, longitude__gte=-180, longitude__lte=180
                    )
                ),
                name='chk_job_location_coordinates',
            ),
        ]
        indexes = [
            models.Index(fields=['location', 'job']),
            models.Index(fields=['latitude', 'longitude'], name='jobs_jobloc_lat_lng_idx'),
        ]

    def __str__(self):
        return f'{self.job_id}: {self.location_id}'


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
                condition=(
                    models.Q(weekday_from__isnull=True) | models.Q(weekday_from__range=(1, 7))
                ),
                name='chk_job_schedule_weekday_from',
            ),
            models.CheckConstraint(
                condition=(models.Q(weekday_to__isnull=True) | models.Q(weekday_to__range=(1, 7))),
                name='chk_job_schedule_weekday_to',
            ),
        ]

    def __str__(self):
        return f'{self.job_id}: {self.weekday_from}-{self.weekday_to}'
