from django.db import models
from django.utils.text import slugify


class Location(models.Model):
    """Standardized administrative location (DB doc section 2.11).

    Vietnam dropped the district tier on 2025-07-01: only 2 levels remain —
    province (34 units) and ward (~3,321 units) attached directly to a
    province. `code` is the official administrative code from the source
    dataset, used to re-sync without regenerating IDs. Seeded via
    `seed_locations` management command, never via live API calls in the
    request path (jobs.location_id must stay stable/independent of a third
    party's uptime).
    """

    class Level(models.TextChoices):
        PROVINCE = 'province', 'Province'
        WARD = 'ward', 'Ward'

    code = models.CharField(max_length=20, unique=True)
    level = models.CharField(max_length=20, choices=Level.choices)
    name = models.CharField(max_length=255)
    ward_type = models.CharField(max_length=20, blank=True, help_text='xã, phường, đặc khu — chỉ khi level=ward')
    province_type = models.CharField(max_length=20, blank=True, help_text='tỉnh, thành phố trực thuộc trung ương — chỉ khi level=province')
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    # Tên các tỉnh cũ hợp thành tỉnh này sau sáp nhập 1/7/2025 (chỉ khi level=province).
    # Rỗng = tỉnh giữ nguyên, không sáp nhập. Seed qua `seed_province_merges`, admin sửa được.
    merged_from = models.JSONField(default=list, blank=True)
    country = models.CharField(max_length=100, default='Vietnam')
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['level', 'name']
        indexes = [
            models.Index(fields=['level']),
            models.Index(fields=['name']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            self.slug = f'{base_slug}-{self.code}' if self.level == self.Level.WARD else base_slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.level})'
