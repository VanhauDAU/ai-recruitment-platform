from django.db import models
from django.utils.text import slugify


class SkillGroup(models.Model):
    """Open taxonomy for grouping skills across every profession."""

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Skill(models.Model):
    """Single source of truth for skills across the whole system (DB doc section 2.8).

    Every place that stores "skills" (candidate profile via CV, CV content,
    job requirements, AI analysis results) references skill_id here instead
    of free-text strings, so CV-Job matching and skill-group classification
    stay consistent.
    """

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    normalized_name = models.CharField(max_length=255, unique=True, editable=False)
    aliases = models.JSONField(default=list, blank=True, help_text='Alternate names for keyword matching, e.g. ["ReactJS", "React.js"]')
    group = models.ForeignKey(
        SkillGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='skills',
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['group__name', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        self.normalized_name = self.name.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.group.name})' if self.group else self.name
