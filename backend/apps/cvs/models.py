from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.skills.models import Skill
from common.public_id import generate_public_id


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
    template = models.ForeignKey(
        'cv_templates.CvTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cvs',
    )
    position = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='candidate_cvs',
    )
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
            models.Index(
                fields=['user', 'lifecycle_status', '-updated_at'], name='idx_user_cvs_lifecycle'
            ),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(
                    status__in=['draft', 'uploaded', 'processing', 'analyzed', 'failed']
                ),
                name='chk_user_cvs_status',
            ),
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_default=True, is_deleted=False),
                name='uq_user_active_default_cv',
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
    # A candidate may permanently delete their library CV after applying. The
    # application-owned immutable snapshot remains available to recruiters,
    # detached from the deleted library aggregate.
    cv = models.ForeignKey(
        UserCv,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='versions',
    )
    version_number = models.PositiveIntegerField()
    version_kind = models.CharField(
        max_length=30, choices=VersionKind.choices, default=VersionKind.MANUAL_SAVE
    )
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
            models.CheckConstraint(
                check=models.Q(version_number__gt=0), name='chk_cv_version_number'
            ),
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
        return f'{self.cv_id or "detached"} v{self.version_number}'


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
    document_hash = models.CharField(max_length=64, blank=True, db_index=True)
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


class CvAsset(models.Model):
    """Immutable media referenced by canonical CV documents through public IDs."""

    class Kind(models.TextChoices):
        AVATAR = 'avatar', 'Avatar'
        BACKGROUND = 'background', 'Background'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cv_assets',
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=120, blank=True)
    storage_key = models.TextField()
    content_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    checksum_sha256 = models.CharField(max_length=64, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['kind', 'is_active', 'created_at'], name='idx_cv_assets_catalog'),
            models.Index(fields=['owner', 'kind', 'created_at'], name='idx_cv_assets_owner_kind'),
        ]

    def clean(self):
        if self.kind == self.Kind.AVATAR and self.owner_id is None:
            raise ValidationError({'owner': 'Avatar assets require an owner.'})
        if self.kind == self.Kind.BACKGROUND and self.owner_id is not None:
            raise ValidationError({'owner': 'Background assets are system-owned.'})

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cva')
        super().save(*args, **kwargs)


class CvSharedLink(models.Model):
    """A revocable bearer link bound to one immutable CV version.

    ``token_hash`` is deliberately the only persisted representation of the
    browser token. The raw token exists solely in the create response.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    cv = models.ForeignKey(UserCv, on_delete=models.CASCADE, related_name='shared_links')
    version = models.ForeignKey(CvVersion, on_delete=models.PROTECT, related_name='shared_links')
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_cv_shared_links',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['expires_at'],
                name='idx_cv_share_active_expiry',
                condition=models.Q(revoked_at__isnull=True),
            ),
            models.Index(fields=['cv', '-created_at'], name='idx_cv_share_cv_created'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvs')
        super().save(*args, **kwargs)


class CvAccessLog(models.Model):
    """Minimal sensitive-CV access audit record; never stores CV payload or raw PII."""

    class ActorType(models.TextChoices):
        OWNER = 'owner', 'Owner'
        RECRUITER = 'recruiter', 'Recruiter'
        ADMIN = 'admin', 'Admin'
        ANONYMOUS = 'anonymous', 'Anonymous'

    class AccessChannel(models.TextChoices):
        OWNER_VIEW = 'owner_view', 'Owner view'
        APPLICATION = 'application', 'Application'
        ADMIN = 'admin', 'Admin'
        SHARED_LINK = 'shared_link', 'Shared link'
        EXPORT = 'export', 'Export'

    cv = models.ForeignKey(UserCv, on_delete=models.PROTECT, related_name='access_logs')
    version = models.ForeignKey(
        CvVersion, on_delete=models.PROTECT, null=True, blank=True, related_name='access_logs'
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cv_access_logs',
    )
    actor_type = models.CharField(max_length=30, choices=ActorType.choices)
    access_channel = models.CharField(max_length=30, choices=AccessChannel.choices)
    shared_link = models.ForeignKey(
        CvSharedLink,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='access_logs',
    )
    ip_hash = models.CharField(max_length=64, blank=True, default='')
    user_agent_hash = models.CharField(max_length=64, blank=True, default='')
    accessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['cv', '-accessed_at'], name='idx_cv_access_cv_time'),
        ]


class CvExport(models.Model):
    """An asynchronous, version-bound PDF artifact.

    The row is both the worker job and the durable artifact record.  It never
    contains a CV payload or public object-storage URL: ``storage_key`` stays
    internal and the V2 download endpoint authorizes every read.
    """

    class ExportFormat(models.TextChoices):
        PDF = 'pdf', 'PDF'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    cv = models.ForeignKey(UserCv, on_delete=models.PROTECT, related_name='exports')
    version = models.ForeignKey(CvVersion, on_delete=models.PROTECT, related_name='exports')
    export_format = models.CharField(
        max_length=20, choices=ExportFormat.choices, default=ExportFormat.PDF
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    renderer_key = models.CharField(max_length=100)
    renderer_version = models.CharField(max_length=50)
    # Declarative worker inputs only (page/renderer/schema), never canonical CV
    # content. The immutable ``version`` row remains the only document source.
    render_config = models.JSONField(default=dict)
    render_config_hash = models.CharField(max_length=64)
    storage_key = models.TextField(blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_cv_exports',
    )
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['version', 'render_config_hash'],
                name='uq_cv_export_version_render_config',
            ),
            models.CheckConstraint(
                check=models.Q(export_format__in=['pdf']),
                name='chk_cv_export_format',
            ),
            models.CheckConstraint(
                check=models.Q(status__in=['pending', 'processing', 'completed', 'failed']),
                name='chk_cv_export_status',
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', 'queued_at'],
                name='idx_cv_exports_pending',
                condition=models.Q(status__in=['pending', 'processing']),
            ),
            models.Index(fields=['cv', '-created_at'], name='idx_cv_exports_cv_created'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cve')
        super().save(*args, **kwargs)


class CvImportJob(models.Model):
    """Durable, idempotent PDF/DOCX-to-canonical processing job."""

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    cv = models.OneToOneField(UserCv, on_delete=models.CASCADE, related_name='import_job')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cv_import_jobs'
    )
    idempotency_key = models.CharField(max_length=100)
    file_checksum_sha256 = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    attempts = models.PositiveIntegerField(default=0)
    failure_code = models.CharField(max_length=80, blank=True)
    result_version = models.ForeignKey(
        CvVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    source_expires_at = models.DateTimeField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'idempotency_key'], name='uq_cv_import_user_idempotency'
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'queued_at'], name='idx_cv_import_pending'),
            models.Index(fields=['source_expires_at'], name='idx_cv_import_expiry'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvi')
        super().save(*args, **kwargs)


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
