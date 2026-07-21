from django.db import models
from django.utils.text import slugify

from .core import Job


class Language(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class JobLanguageRequirement(models.Model):
    class ProficiencyLevel(models.TextChoices):
        BASIC = 'basic', 'Cơ bản'
        CONVERSATIONAL = 'conversational', 'Giao tiếp'
        WORKING = 'working', 'Làm việc'
        PROFESSIONAL = 'professional', 'Thành thạo'
        NATIVE = 'native', 'Bản ngữ'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='language_requirements')
    language = models.ForeignKey(
        Language, on_delete=models.PROTECT, related_name='job_requirements'
    )
    proficiency_level = models.CharField(
        max_length=30, choices=ProficiencyLevel.choices, blank=True
    )
    certificate = models.CharField(max_length=255, blank=True)
    note = models.CharField(max_length=500, blank=True)
    is_required = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['job', 'language'], name='uq_job_language')]
        indexes = [models.Index(fields=['language', 'proficiency_level'])]
