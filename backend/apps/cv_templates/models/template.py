"""Template catalogue: templates, their taxonomy and their color palette."""

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils.text import slugify

from common.db.public_id import generate_public_id

from .language import localized_field


class CvTemplate(models.Model):
    """CV Builder template (DB doc section 2.4)."""

    class LifecycleStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    # Nội dung song ngữ. Template chỉ xuất hiện ở kho mẫu của ngôn ngữ có
    # `display_name_<ngôn ngữ>` khác rỗng.
    display_name_vi = models.CharField(max_length=255, blank=True)
    display_name_en = models.CharField(max_length=255, blank=True)
    description_vi = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    seo_title_vi = models.CharField(max_length=255, blank=True)
    seo_title_en = models.CharField(max_length=255, blank=True)
    seo_description_vi = models.TextField(blank=True)
    seo_description_en = models.TextField(blank=True)
    is_premium = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    usage_count = models.IntegerField(default=0)
    # Nguồn sự thật duy nhất cho việc hiển thị công khai: chỉ template
    # `published` có version đang published mới vào kho mẫu. Ảnh xem trước nằm ở
    # `CvTemplateColorLink` của từng màu.
    lifecycle_status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.DRAFT,
    )
    current_published_version = models.ForeignKey(
        'CvTemplateVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    categories = models.ManyToManyField(
        'CvCategory',
        through='CvTemplateCategoryLink',
        related_name='templates',
        blank=True,
    )
    colors = models.ManyToManyField(
        'CvColor',
        through='CvTemplateColorLink',
        related_name='templates',
        blank=True,
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cv_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tpl')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def localized(self, field, language):
        return getattr(self, localized_field(field, language))

    def offers_color(self, hex_code):
        """Màu `hex_code` có trong bảng màu đang bật của template."""
        return self.color_links.filter(
            color__hex_code__iexact=hex_code, color__is_active=True
        ).exists()


class CvCategory(models.Model):
    """Typed taxonomy for templates; a template may belong to many groups."""

    class CategoryType(models.TextChoices):
        STYLE = 'style', 'Style'
        FEATURE = 'feature', 'Feature'
        POSITION = 'position', 'Position'
        AUDIENCE = 'audience', 'Audience'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    category_type = models.CharField(max_length=30, choices=CategoryType.choices)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['category_type', 'slug'], name='uq_cv_categories_type_slug'
            ),
        ]
        ordering = ['category_type', 'sort_order', 'name']

    def __str__(self):
        return f'{self.category_type}: {self.name}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvcat')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class CvColor(models.Model):
    """Reusable catalogue color; preview assets belong to the template link."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=100, unique=True)
    hex_code = models.CharField(
        max_length=7,
        unique=True,
        validators=[RegexValidator(r'^#[0-9A-Fa-f]{6}$', 'Use a six-digit hex color.')],
    )
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f'{self.name} ({self.hex_code})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvcolor')
        if not self.slug:
            self.slug = slugify(f'{self.name}-{self.hex_code.lstrip("#")}')
        self.hex_code = self.hex_code.upper()
        super().save(*args, **kwargs)


class CvTemplateCategoryLink(models.Model):
    template = models.ForeignKey(
        CvTemplate, on_delete=models.CASCADE, related_name='category_links'
    )
    category = models.ForeignKey(
        CvCategory, on_delete=models.CASCADE, related_name='template_links'
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['template', 'category'], name='uq_cv_template_category_link'
            ),
        ]

    def __str__(self):
        return f'{self.template_id} → {self.category_id}'


class CvTemplateColorLink(models.Model):
    template = models.ForeignKey(CvTemplate, on_delete=models.CASCADE, related_name='color_links')
    color = models.ForeignKey(CvColor, on_delete=models.PROTECT, related_name='template_links')
    thumbnail_url = models.TextField(blank=True)
    preview_url = models.TextField(blank=True)
    snapshot_fingerprint = models.CharField(max_length=64, blank=True)
    snapshot_generated_at = models.DateTimeField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'pk']
        constraints = [
            models.UniqueConstraint(fields=['template', 'color'], name='uq_cv_template_color_link'),
            models.UniqueConstraint(
                fields=['template'],
                condition=models.Q(is_default=True),
                name='uq_cv_template_default_color',
            ),
        ]

    def __str__(self):
        return f'{self.template_id} → {self.color_id}'
