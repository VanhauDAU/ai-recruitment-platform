from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id

from .experience import ExperienceBand
from .language import CvLanguage, localized_field


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

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tpl')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def localized(self, field, language):
        return getattr(self, localized_field(field, language))

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
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='published_cv_template_versions',
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
                condition=models.Q(version_number__gt=0), name='chk_cv_template_version_number'
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
        'published_by_id',
        'published_at',
        'created_at',
    )

    def clean(self):
        from ..renderers import validate_renderer_contract

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


class CvPositionProfile(models.Model):
    """Cấu hình CV cho một vị trí chuyên môn.

    Gắn 1-1 với `JobCategory(category_type=specialization)` — cùng taxonomy với
    tin tuyển dụng, nên tên, slug và bản dịch của vị trí lấy từ `JobCategory`
    thay vì lưu lặp ở đây. Vị trí chỉ xuất hiện ở ô chọn của trang mẫu CV khi có
    profile đang bật.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    job_category = models.OneToOneField(
        'jobs.JobCategory',
        on_delete=models.CASCADE,
        related_name='cv_position_profile',
    )
    # Thứ tự và trạng thái bật của section khi dựng CV từ nội dung mẫu của vị
    # trí, ví dụ [{"section_key": "skills", "enabled": true}, ...]. Rỗng = giữ
    # nguyên thứ tự của nội dung mẫu.
    section_preset = models.JSONField(default=list, blank=True)
    # Từ khóa kỹ năng gợi ý của vị trí (dùng cho prompt sinh nội dung mẫu và đối
    # chiếu vị trí khi trích xuất CV tải lên).
    keywords = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    MAX_KEYWORDS = 30

    class Meta:
        ordering = ['sort_order', 'pk']

    def clean(self):
        from apps.jobs.models import JobCategory

        from ..section_registry import get_section_contract

        if self.job_category.category_type != JobCategory.CategoryType.SPECIALIZATION:
            raise ValidationError({'job_category': 'Chỉ gắn với vị trí chuyên môn.'})
        if not isinstance(self.section_preset, list):
            raise ValidationError({'section_preset': 'Phải là danh sách.'})
        keys = []
        for entry in self.section_preset:
            key = entry.get('section_key') if isinstance(entry, dict) else None
            if not get_section_contract(key) or not isinstance(entry.get('enabled', True), bool):
                raise ValidationError({'section_preset': f'Section không hợp lệ: {entry!r}.'})
            keys.append(key)
        if len(keys) != len(set(keys)):
            raise ValidationError({'section_preset': 'Section bị lặp.'})
        if (
            not isinstance(self.keywords, list)
            or len(self.keywords) > self.MAX_KEYWORDS
            or any(
                not isinstance(word, str) or not 0 < len(word.strip()) <= 60
                for word in self.keywords
            )
        ):
            raise ValidationError(
                {'keywords': f'Tối đa {self.MAX_KEYWORDS} từ khóa, mỗi từ khóa 1–60 ký tự.'}
            )

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvpos')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.job_category.name


class CvSampleContent(models.Model):
    """Published canonical starter content; never tied to a renderer/template."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        # Nội dung do AI sinh, chờ admin duyệt (CVT-3).
        IN_REVIEW = 'in_review', 'In review'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class Origin(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        AI = 'ai', 'AI'
        IMPORT = 'import', 'Import'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    # Null = nội dung chung cho mọi vị trí; chuỗi có thể chứa token
    # `{position}`, được thay bằng tên vị trí theo ngôn ngữ khi dựng CV.
    position_profile = models.ForeignKey(
        CvPositionProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sample_contents',
    )
    locale = models.CharField(max_length=16, choices=CvLanguage.choices)
    experience_band = models.CharField(max_length=20, choices=ExperienceBand.choices)
    title = models.CharField(max_length=255)
    content_json = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    origin = models.CharField(max_length=20, choices=Origin.choices, default=Origin.MANUAL)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cv_sample_contents',
    )
    # Admin đã duyệt nội dung (bắt buộc với nội dung AI trước khi xuất bản).
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_cv_sample_contents',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['status', 'locale', 'experience_band'], name='idx_cv_samples_catalog'
            ),
        ]
        # Mỗi tổ hợp chỉ có một nội dung đang xuất bản; bản nháp, bản AI chờ
        # duyệt và bản lưu trữ của cùng tổ hợp cùng tồn tại được (CVT-3).
        constraints = [
            models.UniqueConstraint(
                fields=['position_profile', 'locale', 'experience_band'],
                condition=models.Q(position_profile__isnull=False, status='published'),
                name='uq_cv_sample_published_position',
            ),
            models.UniqueConstraint(
                fields=['locale', 'experience_band'],
                condition=models.Q(position_profile__isnull=True, status='published'),
                name='uq_cv_sample_published_generic',
            ),
        ]
        ordering = ['locale', 'experience_band', 'title']

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
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
