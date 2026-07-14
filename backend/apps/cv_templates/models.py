from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class CvTemplate(models.Model):
    """CV Builder template (DB doc section 2.4)."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'

    class LifecycleStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

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
    # `status` is the legacy public-catalogue switch.  Lifecycle and the
    # current immutable version are the V2 source of truth; both fields stay
    # during the dual-read window so existing clients remain compatible.
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
    archived_at = models.DateTimeField(null=True, blank=True)
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
            models.UniqueConstraint(fields=['category_type', 'slug'], name='uq_cv_categories_type_slug'),
        ]
        ordering = ['category_type', 'sort_order', 'name']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvcat')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.category_type}: {self.name}'


class CvTemplateVersion(models.Model):
    """Immutable renderer and presentation contract for one template release."""

    class VersionStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        RETIRED = 'retired', 'Retired'

    template = models.ForeignKey(CvTemplate, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    version_status = models.CharField(max_length=20, choices=VersionStatus.choices, default=VersionStatus.DRAFT)
    renderer_key = models.CharField(max_length=100)
    renderer_version = models.CharField(max_length=50, default='1')
    schema_version = models.PositiveIntegerField(default=1)
    layout_schema = models.JSONField(default=dict, blank=True)
    style_schema = models.JSONField(default=dict, blank=True)
    default_layout_json = models.JSONField(default=dict, blank=True)
    default_style_json = models.JSONField(default=dict, blank=True)
    capabilities = models.JSONField(default=dict, blank=True)
    content_contract = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cv_template_versions',
    )
    published_at = models.DateTimeField(null=True, blank=True)
    retired_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['template', 'version_number'], name='uq_cv_template_version'),
            models.CheckConstraint(check=models.Q(version_number__gt=0), name='chk_cv_template_version_number'),
        ]
        indexes = [
            models.Index(fields=['template', 'version_status', '-version_number'], name='idx_tpl_version_published'),
        ]
        ordering = ['template_id', '-version_number']

    def clean(self):
        from .renderers import validate_renderer_contract

        regions = [
            region.get('id') for region in self.default_layout_json.get('regions', [])
            if isinstance(region, dict)
        ]
        contract = validate_renderer_contract(self.renderer_key, self.schema_version, regions)
        if self.renderer_version != contract.version:
            from django.core.exceptions import ValidationError

            raise ValidationError({'renderer_version': 'Does not match the deployed renderer contract.'})

    def __str__(self):
        return f'{self.template_id} v{self.version_number}'


class CvTemplateLocalization(models.Model):
    template = models.ForeignKey(CvTemplate, on_delete=models.CASCADE, related_name='localizations')
    locale = models.CharField(max_length=16)
    display_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['template', 'locale'], name='uq_cv_template_locale'),
        ]


class CvTemplateCategoryLink(models.Model):
    template = models.ForeignKey(CvTemplate, on_delete=models.CASCADE, related_name='category_links')
    category = models.ForeignKey(CvCategory, on_delete=models.CASCADE, related_name='template_links')
    sort_order = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['template', 'category'], name='uq_cv_template_category_link'),
        ]


class CvSectionDefinition(models.Model):
    """Database registry entry for a canonical CV section key."""

    section_key = models.CharField(max_length=80, unique=True)
    display_name = models.CharField(max_length=120)
    data_schema = models.JSONField(default=dict)
    allow_multiple = models.BooleanField(default=False)
    is_system = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    schema_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.section_key


class CvTemplateSection(models.Model):
    template_version = models.ForeignKey(CvTemplateVersion, on_delete=models.CASCADE, related_name='sections')
    section_definition = models.ForeignKey(CvSectionDefinition, on_delete=models.PROTECT, related_name='template_sections')
    region_key = models.CharField(max_length=80)
    default_order = models.IntegerField(default=0)
    is_required = models.BooleanField(default=False)
    is_default_enabled = models.BooleanField(default=True)
    is_draggable = models.BooleanField(default=True)
    use_theme_color = models.BooleanField(default=True)
    config_json = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['template_version', 'section_definition', 'region_key'],
                name='uq_template_version_section',
            ),
        ]
