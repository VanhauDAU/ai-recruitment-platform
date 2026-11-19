"""Images referenced by CV documents (avatars, catalogue backgrounds)."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.db.public_id import generate_public_id
from common.storage.r2 import private_media_storage, public_media_storage


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

    def __str__(self):
        return f'{self.kind} {self.public_id}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cva')
        super().save(*args, **kwargs)

    def clean(self):
        if self.kind == self.Kind.AVATAR and self.owner_id is None:
            raise ValidationError({'owner': 'Avatar assets require an owner.'})
        if self.kind == self.Kind.BACKGROUND and self.owner_id is not None:
            raise ValidationError({'owner': 'Background assets are system-owned.'})

    def storage(self):
        """Ảnh nền là asset catalogue công khai; avatar ứng viên luôn ở storage riêng tư."""
        if self.kind == self.Kind.BACKGROUND:
            return public_media_storage()
        return private_media_storage()

    def deactivate(self):
        """Ẩn asset (không xóa tệp): token, catalogue và document mới không dùng được nữa."""
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])
