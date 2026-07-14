from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.public_id import generate_public_id
from apps.skills.models import Skill


class UserCv(models.Model):
    """A candidate's CV — either built with the CV Builder or uploaded (DB doc section 2.5)."""

    class CvType(models.TextChoices):
        BUILDER = 'builder', 'Builder'
        UPLOADED = 'uploaded', 'Uploaded'

    class Source(models.TextChoices):
        BUILDER = 'builder', 'Builder'
        UPLOADED = 'uploaded', 'Uploaded'
        IMPORTED = 'imported', 'Imported'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        UPLOADED = 'uploaded', 'Uploaded'
        PROCESSING = 'processing', 'Processing'
        ANALYZED = 'analyzed', 'Analyzed'
        FAILED = 'failed', 'Failed'

    class LifecycleStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class ProcessingStatus(models.TextChoices):
        IDLE = 'idle', 'Idle'
        QUEUED = 'queued', 'Queued'
        PROCESSING = 'processing', 'Processing'
        ANALYZED = 'analyzed', 'Analyzed'
        FAILED = 'failed', 'Failed'

    class Visibility(models.TextChoices):
        PRIVATE = 'private', 'Private'
        APPLICATION_ONLY = 'application_only', 'Application only'
        SHARED_LINK = 'shared_link', 'Shared link'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cvs')
    template = models.ForeignKey('cv_templates.CvTemplate', on_delete=models.SET_NULL, null=True, blank=True, related_name='cvs')
    cv_type = models.CharField(max_length=50, choices=CvType.choices)
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.BUILDER)
    title = models.CharField(max_length=255)
    cv_data = models.JSONField(default=dict, blank=True)
    style_config = models.JSONField(default=dict, blank=True)
    file_url = models.TextField(blank=True)
    pdf_url = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=50, blank=True, help_text='pdf, docx')
    raw_text = models.TextField(blank=True)
    normalized_text = models.TextField(blank=True)
    current_version = models.IntegerField(default=1)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.DRAFT)
    error_message = models.TextField(blank=True)
    # V2 fields are additive.  `cv_data`, `style_config`, and `status` remain
    # available while clients dual-read during the migration window.
    language = models.CharField(max_length=16, default='vi-VN')
    lifecycle_status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.DRAFT,
    )
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.IDLE,
    )
    visibility = models.CharField(
        max_length=30,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
    )
    current_template_version = models.ForeignKey(
        'cv_templates.CvTemplateVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_cvs',
    )
    latest_version = models.ForeignKey(
        'CvVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    published_version = models.ForeignKey(
        'CvVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    lock_version = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    last_analyzed_at = models.DateTimeField(null=True, blank=True)
    last_exported_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(fields=['user', 'lifecycle_status', '-updated_at'], name='idx_user_cvs_lifecycle'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'uploaded', 'processing', 'analyzed', 'failed']),
                name='chk_user_cvs_status',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cv')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.title} ({self.user.email})'


class ImmutableCvVersionError(ValidationError):
    """Raised when application code attempts to mutate a saved CV snapshot."""


class CvVersion(models.Model):
    """Immutable canonical CV document used by publish, export and apply flows."""

    class VersionKind(models.TextChoices):
        INITIAL = 'initial', 'Initial'
        MANUAL_SAVE = 'manual_save', 'Manual save'
        PUBLISHED = 'published', 'Published'
        APPLICATION_SNAPSHOT = 'application_snapshot', 'Application snapshot'
        EXPORT_SNAPSHOT = 'export_snapshot', 'Export snapshot'
        IMPORTED = 'imported', 'Imported'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    cv = models.ForeignKey(UserCv, on_delete=models.PROTECT, related_name='versions')
    version_number = models.PositiveIntegerField()
    version_kind = models.CharField(max_length=30, choices=VersionKind.choices, default=VersionKind.MANUAL_SAVE)
    template_version = models.ForeignKey(
        'cv_templates.CvTemplateVersion',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='cv_versions',
    )
    parent_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_versions',
    )
    schema_version = models.PositiveIntegerField(default=1)
    content_json = models.JSONField(default=dict)
    layout_json = models.JSONField(default=dict)
    style_json = models.JSONField(default=dict)
    plain_text = models.TextField(blank=True)
    content_hash = models.CharField(max_length=64)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cv_versions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cv', 'version_number'], name='uq_cv_version_number'),
            models.CheckConstraint(check=models.Q(version_number__gt=0), name='chk_cv_version_number'),
        ]
        indexes = [
            models.Index(fields=['cv', '-version_number'], name='idx_cv_versions_cv_created'),
            models.Index(fields=['content_hash'], name='idx_cv_versions_content_hash'),
        ]
        ordering = ['cv_id', '-version_number']

    def clean(self):
        from .schemas import validate_cv_document

        validate_cv_document(
            content_json=self.content_json,
            layout_json=self.layout_json,
            style_json=self.style_json,
            schema_version=self.schema_version,
        )
        if self.template_version_id:
            from apps.cv_templates.renderers import validate_renderer_contract

            validate_renderer_contract(
                self.template_version.renderer_key,
                self.schema_version,
                [region.get('id') for region in self.layout_json.get('regions', [])],
            )

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ImmutableCvVersionError('CvVersion rows are immutable.')
        if not self.public_id:
            self.public_id = generate_public_id('cvv')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.cv_id} v{self.version_number}'


class CvDraft(models.Model):
    """One mutable autosave document per CV, guarded by optimistic locking."""

    cv = models.OneToOneField(UserCv, on_delete=models.CASCADE, related_name='draft')
    base_version = models.ForeignKey(
        CvVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drafts_based_on',
    )
    content_json = models.JSONField(default=dict)
    layout_json = models.JSONField(default=dict)
    style_json = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    lock_version = models.PositiveIntegerField(default=0)
    client_session_id = models.CharField(max_length=100, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_cv_drafts',
    )
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        from .schemas import validate_cv_document

        validate_cv_document(
            content_json=self.content_json,
            layout_json=self.layout_json,
            style_json=self.style_json,
            schema_version=self.schema_version,
        )


class CvSkill(models.Model):
    """Skills detected/declared in a specific CV (DB doc section 2.9)."""

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        AI_EXTRACTED = 'ai_extracted', 'AI extracted'

    class Level(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    cv = models.ForeignKey(UserCv, on_delete=models.CASCADE, related_name='cv_skills')
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='cv_skills')
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.MANUAL)
    level = models.CharField(max_length=50, choices=Level.choices, blank=True)
    years_experience = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    evidence_text = models.TextField(blank=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cv', 'skill'], name='uq_cv_skills_cv_skill'),
        ]

    def __str__(self):
        return f'{self.cv_id} - {self.skill.name}'
