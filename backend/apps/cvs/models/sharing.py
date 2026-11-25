"""Bearer share links of a CV version and the audit trail of sensitive CV reads."""

from django.conf import settings
from django.db import models

from common.db.public_id import generate_public_id

from .cv import UserCv
from .versions import CvVersion


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

    def __str__(self):
        return self.public_id

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
        # Nhà tuyển dụng mở hồ sơ trích xuất ẩn danh ở Tìm CV (không mở tệp CV).
        RECRUITER_SEARCH = 'recruiter_search', 'Recruiter search'

    # NULL for recruiter access to an application snapshot (keyed by version).
    cv = models.ForeignKey(
        UserCv, on_delete=models.PROTECT, null=True, blank=True, related_name='access_logs'
    )
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
    # Lý do admin nhập khi xem nội dung CV ứng viên (CVT-4); trống với kênh khác.
    reason = models.CharField(max_length=255, blank=True, default='')
    accessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['cv', '-accessed_at'], name='idx_cv_access_cv_time'),
        ]

    def __str__(self):
        return f'{self.access_channel}/{self.actor_type} #{self.pk}'
