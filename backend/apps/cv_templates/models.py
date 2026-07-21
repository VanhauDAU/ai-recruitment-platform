from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
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
    category = models.CharField(
        max_length=100, blank=True, help_text='IT, internship, professional, simple'
    )
    description = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    preview_url = models.TextField(blank=True)
    layout_config = models.JSONField(
        default=dict, blank=True, help_text='one-column, two-column, ...'
    )
    style_config = models.JSONField(
        default=dict, blank=True, help_text='color, font, spacing defaults'
    )
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
            models.UniqueConstraint(
                fields=['category_type', 'slug'], name='uq_cv_categories_type_slug'
            ),
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

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvcolor')
        if not self.slug:
            self.slug = slugify(f'{self.name}-{self.hex_code.lstrip("#")}')
        self.hex_code = self.hex_code.upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.hex_code})'


class CvTemplateVersion(models.Model):
    """Immutable renderer and presentation contract for one template release."""

    class VersionStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        RETIRED = 'retired', 'Retired'

    template = models.ForeignKey(CvTemplate, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    version_status = models.CharField(
        max_length=20, choices=VersionStatus.choices, default=VersionStatus.DRAFT
    )
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
            models.UniqueConstraint(
                fields=['template', 'version_number'], name='uq_cv_template_version'
            ),
            models.CheckConstraint(
                check=models.Q(version_number__gt=0), name='chk_cv_template_version_number'
            ),
        ]
        indexes = [
            models.Index(
                fields=['template', 'version_status', '-version_number'],
                name='idx_tpl_version_published',
            ),
        ]
        ordering = ['template_id', '-version_number']

    _IMMUTABLE_FIELDS = (
        'template_id',
        'version_number',
        'renderer_key',
        'renderer_version',
        'schema_version',
        'layout_schema',
        'style_schema',
        'default_layout_json',
        'default_style_json',
        'capabilities',
        'content_contract',
        'created_by_id',
        'published_at',
        'created_at',
    )

    def clean(self):
        from .renderers import validate_renderer_contract

        regions = [
            region.get('id')
            for region in self.default_layout_json.get('regions', [])
            if isinstance(region, dict)
        ]
        contract = validate_renderer_contract(self.renderer_key, self.schema_version, regions)
        if self.renderer_version != contract.version:
            raise ValidationError(
                {'renderer_version': 'Does not match the deployed renderer contract.'}
            )

    def save(self, *args, **kwargs):
        """Keep a published renderer contract stable for every existing CV."""
        if self.pk:
            persisted = type(self).objects.get(pk=self.pk)
            changed_fields = [
                field
                for field in self._IMMUTABLE_FIELDS
                if getattr(self, field) != getattr(persisted, field)
            ]
            if persisted.version_status == self.VersionStatus.RETIRED:
                raise ValidationError('Retired template versions are immutable.')
            if persisted.version_status == self.VersionStatus.PUBLISHED:
                if changed_fields:
                    raise ValidationError(
                        {'version': 'Published template configuration is immutable.'}
                    )
                if self.version_status not in {
                    self.VersionStatus.PUBLISHED,
                    self.VersionStatus.RETIRED,
                }:
                    raise ValidationError(
                        {'version_status': 'A published version may only be retired.'}
                    )
                if (
                    self.version_status == self.VersionStatus.PUBLISHED
                    and self.retired_at != persisted.retired_at
                ):
                    raise ValidationError(
                        {'retired_at': 'Set retired_at only when retiring a version.'}
                    )
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.template_id} v{self.version_number}'


class CvTemplateLocalization(models.Model):
    template = models.ForeignKey(CvTemplate, on_delete=models.CASCADE, related_name='localizations')
    locale = models.CharField(max_length=16)
    locale_ref = models.ForeignKey(
        'sitecontent.Locale',
        to_field='code',
        db_column='locale_ref_code',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='cv_template_localizations',
    )
    display_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['template', 'locale'], name='uq_cv_template_locale'),
        ]

    def save(self, *args, **kwargs):
        from apps.sitecontent.models import Locale

        self.locale_ref_id = (
            self.locale if Locale.objects.filter(code=self.locale).exists() else None
        )
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
    template_version = models.ForeignKey(
        CvTemplateVersion, on_delete=models.CASCADE, related_name='sections'
    )
    section_definition = models.ForeignKey(
        CvSectionDefinition, on_delete=models.PROTECT, related_name='template_sections'
    )
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

    def save(self, *args, **kwargs):
        if self.template_version_id:
            version_status = (
                CvTemplateVersion.objects.only('version_status')
                .get(
                    pk=self.template_version_id,
                )
                .version_status
            )
            if version_status != CvTemplateVersion.VersionStatus.DRAFT:
                raise ValidationError(
                    'Sections of published or retired template versions are immutable.'
                )
        super().save(*args, **kwargs)


class CvSampleContent(models.Model):
    """Published canonical starter content; never tied to a renderer/template."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    job_category = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cv_sample_contents',
    )
    locale = models.CharField(max_length=16)
    locale_ref = models.ForeignKey(
        'sitecontent.Locale',
        to_field='code',
        db_column='locale_ref_code',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='cv_sample_contents',
    )
    experience_level = models.CharField(max_length=30, default='unspecified')
    title = models.CharField(max_length=255)
    # The picker is intentionally Vietnamese even when the sample content is
    # rendered in another locale.  Keep this presentation label beside the
    # canonical sample so the API does not make the client infer it from
    # localized content.
    position_name_vi = models.CharField(max_length=255, blank=True)
    content_json = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cv_sample_contents',
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['status', 'locale', 'experience_level'], name='idx_cv_samples_catalog'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['job_category', 'locale', 'experience_level'],
                name='uq_cv_sample_position_locale_level',
            ),
        ]
        ordering = ['locale', 'experience_level', 'title']

    def clean(self):
        from apps.cvs.schemas import empty_layout, empty_style, validate_cv_document

        content = self.content_json if isinstance(self.content_json, dict) else {}
        section_ids = [
            section.get('instance_id')
            for section in content.get('sections', [])
            if isinstance(section, dict) and section.get('instance_id')
        ]
        layout = empty_layout()
        layout['regions'][0]['section_instance_ids'] = section_ids
        validate_cv_document(
            content_json=content,
            layout_json=layout,
            style_json=empty_style(),
            schema_version=self.schema_version,
        )
        if content.get('locale') != self.locale:
            from django.core.exceptions import ValidationError

            raise ValidationError({'locale': 'Must match content_json.locale.'})

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvsample')
        from apps.sitecontent.models import Locale

        self.locale_ref_id = (
            self.locale if Locale.objects.filter(code=self.locale).exists() else None
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class CvContentBlueprint(models.Model):
    """Admin-configurable generic starter content for a locale/experience pair."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    locale = models.CharField(max_length=16)
    locale_ref = models.ForeignKey(
        'sitecontent.Locale',
        to_field='code',
        db_column='locale_ref_code',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='cv_content_blueprints',
    )
    experience_level = models.CharField(max_length=30, default='unspecified')
    content_json_template = models.JSONField(
        default=dict,
        blank=True,
        help_text='Canonical content template; strings may contain {position}.',
    )
    summary_title = models.CharField(max_length=255)
    summary_template = models.TextField(
        help_text='Dùng {position} tại nơi cần chèn tên vị trí đã bản địa hóa.'
    )
    experience_title = models.CharField(max_length=255)
    experience_company = models.CharField(max_length=255)
    experience_description_template = models.TextField(
        help_text='Dùng {position} tại nơi cần chèn tên vị trí.'
    )
    education_title = models.CharField(max_length=255)
    education_degree = models.CharField(max_length=255)
    education_institution = models.CharField(max_length=255)
    education_description = models.TextField(blank=True)
    skills_title = models.CharField(max_length=255)
    skill_templates = models.JSONField(
        default=list, help_text='Danh sách chuỗi; có thể dùng {position}.'
    )
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_cv_content_blueprints',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['locale', 'experience_level'], name='uq_cv_content_blueprint'
            ),
        ]
        ordering = ['locale', 'experience_level']

    def clean(self):
        if not isinstance(self.skill_templates, list) or not all(
            isinstance(item, str) for item in self.skill_templates
        ):
            raise ValidationError({'skill_templates': 'Must be a list of strings.'})
        if self.content_json_template:
            from apps.cvs.schemas import empty_layout, empty_style, validate_cv_document
            from .services.position_content import _materialize_tokens

            content = _materialize_tokens(self.content_json_template, 'Software Engineer')
            content['locale'] = self.locale
            section_ids = [
                section.get('instance_id')
                for section in content.get('sections', [])
                if isinstance(section, dict) and section.get('instance_id')
            ]
            layout = empty_layout()
            layout['regions'][0]['section_instance_ids'] = section_ids
            validate_cv_document(
                content_json=content,
                layout_json=layout,
                style_json=empty_style(),
                schema_version=content.get('schema_version', 1),
            )

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvblueprint')
        from apps.sitecontent.models import Locale

        self.locale_ref_id = (
            self.locale if Locale.objects.filter(code=self.locale).exists() else None
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.locale} / {self.experience_level}'
