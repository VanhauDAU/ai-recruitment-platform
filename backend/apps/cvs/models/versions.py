"""A CV's documents: immutable versions and the single mutable autosave draft."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.cv_templates.domain import validate_renderer_contract
from apps.cv_templates.models import validate_cv_document
from common.db.public_id import generate_public_id

from .cv import UserCv


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
    # Only on the application snapshot of an uploaded CV: a private copy of the
    # file the candidate submitted, so recruiters read exactly that file even
    # after the library CV is deleted. Never serialized to clients.
    # ``db_default``: older data migrations insert versions through historical
    # models that do not know these columns.
    source_file_key = models.CharField(max_length=500, blank=True, default='', db_default='')
    source_file_type = models.CharField(max_length=10, blank=True, default='', db_default='')
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
                condition=models.Q(version_number__gt=0), name='chk_cv_version_number'
            ),
        ]
        indexes = [
            models.Index(fields=['cv', '-version_number'], name='idx_cv_versions_cv_created'),
            models.Index(fields=['content_hash'], name='idx_cv_versions_content_hash'),
        ]
        ordering = ['cv_id', '-version_number']

    def __str__(self):
        return f'{self.cv_id or "detached"} v{self.version_number}'

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ImmutableCvVersionError('CvVersion rows are immutable.')
        if not self.public_id:
            self.public_id = generate_public_id('cvv')
        super().save(*args, **kwargs)

    def clean(self):
        validate_cv_document(
            content_json=self.content_json,
            layout_json=self.layout_json,
            style_json=self.style_json,
            schema_version=self.schema_version,
        )
        if self.template_version_id:
            validate_renderer_contract(
                self.template_version.renderer_key,
                self.schema_version,
                [region.get('id') for region in self.layout_json.get('regions', [])],
            )


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

    def __str__(self):
        return f'{self.cv_id} draft (lock {self.lock_version})'

    def clean(self):
        validate_cv_document(
            content_json=self.content_json,
            layout_json=self.layout_json,
            style_json=self.style_json,
            schema_version=self.schema_version,
        )
