"""Durable background jobs of a CV: PDF export artifacts and file imports."""

from django.conf import settings
from django.db import models

from common.db.public_id import generate_public_id

from .cv import UserCv
from .versions import CvVersion


class CvExport(models.Model):
    """An asynchronous, version-bound PDF artifact.

    The row is both the worker job and the durable artifact record.  It never
    contains a CV payload or public object-storage URL: ``storage_key`` stays
    internal and the owner download endpoint authorizes every read.
    """

    class ExportFormat(models.TextChoices):
        PDF = 'pdf', 'PDF'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    # NULL for application-snapshot exports, which outlive the library CV.
    cv = models.ForeignKey(
        UserCv, on_delete=models.PROTECT, null=True, blank=True, related_name='exports'
    )
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
                condition=models.Q(export_format__in=['pdf']),
                name='chk_cv_export_format',
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=['pending', 'processing', 'completed', 'failed']),
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

    def __str__(self):
        return f'{self.public_id} ({self.status})'

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

    def __str__(self):
        return f'{self.public_id} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvi')
        super().save(*args, **kwargs)
