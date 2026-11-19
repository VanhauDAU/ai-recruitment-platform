from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy

from .core import Job


class Benefit(models.Model):
    class Category(models.TextChoices):
        ALLOWANCE = 'allowance', gettext_lazy('Phụ cấp')
        EQUIPMENT = 'equipment', gettext_lazy('Hỗ trợ thiết bị làm việc')
        WELFARE = 'welfare', gettext_lazy('Phúc lợi')
        OTHER = 'other', gettext_lazy('Khác')

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    icon = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class JobBenefit(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_benefits')
    benefit = models.ForeignKey(Benefit, on_delete=models.PROTECT, related_name='job_assignments')
    note = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['job', 'benefit'], name='uq_job_benefit')]

    def __str__(self):
        return f'{self.job_id}: {self.benefit_id}'
