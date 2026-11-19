"""Taxonomy ngành nghề/chuyên môn dùng để lọc tin và bản địa hóa tên hiển thị."""

from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id


class JobCategory(models.Model):
    """Industry/field taxonomy for filtering jobs (DB doc section 2.10)."""

    class CategoryType(models.TextChoices):
        OCCUPATION_GROUP = 'occupation_group', gettext_lazy('Nhóm nghề')
        DOMAIN = 'domain', gettext_lazy('Kiến thức chuyên ngành')
        SPECIALIZATION = 'specialization', gettext_lazy('Vị trí chuyên môn')

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    logo_url = models.TextField(
        blank=True,
        help_text='Storage key nội bộ hoặc URL ngoài; API tự resolve storage key thành URL public.',
    )
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children'
    )
    category_type = models.CharField(
        max_length=30,
        choices=CategoryType.choices,
        default=CategoryType.SPECIALIZATION,
    )
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'job categories'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jobcat')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class JobCategoryLocalization(models.Model):
    """Admin-managed display/search text for one taxonomy node and locale."""

    class Locale(models.TextChoices):
        VI = 'vi-VN', gettext_lazy('Tiếng Việt')
        EN = 'en-US', gettext_lazy('Tiếng Anh')

    category = models.ForeignKey(
        JobCategory,
        on_delete=models.CASCADE,
        related_name='localizations',
    )
    locale = models.CharField(max_length=16, choices=Locale.choices)
    display_name = models.CharField(max_length=255)
    search_aliases = models.TextField(
        blank=True, help_text='Các từ khóa tìm kiếm, phân tách bằng dấu phẩy.'
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['locale', 'is_active', 'sort_order'], name='idx_jobcatloc_picker'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'locale'], name='uq_job_category_localization'
            ),
        ]
        ordering = ['locale', 'sort_order', 'display_name', 'category_id']

    def __str__(self):
        return f'{self.category.name} ({self.locale})'
