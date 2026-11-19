"""Immutable renderer contracts of a template release and their section registry."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from ..domain.renderers import validate_renderer_contract
from .template import CvTemplate


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

    def __str__(self):
        return f'{self.template_id} v{self.version_number}'

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

    def clean(self):
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

    def __str__(self):
        return f'{self.template_version_id}: {self.section_definition_id} @ {self.region_key}'

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
