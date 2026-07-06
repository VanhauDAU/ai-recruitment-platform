from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class CvTemplate(models.Model):
    """CV Builder template (DB doc section 2.4)."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    category = models.CharField(max_length=100, blank=True, help_text='IT, internship, professional, simple')
    description = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    preview_url = models.TextField(blank=True)
    layout_config = models.JSONField(default=dict, blank=True, help_text='one-column, two-column, ...')
    style_config = models.JSONField(default=dict, blank=True, help_text='color, font, spacing defaults')
    is_premium = models.BooleanField(default=False)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ACTIVE)
    sort_order = models.IntegerField(default=0)
    usage_count = models.IntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_cv_templates')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tpl')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
