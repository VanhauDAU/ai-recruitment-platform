"""Layout, delegated editors and change history of the public company page."""

from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from ..page_registry import DEFAULT_ACCENT_KEY
from .company import Company
from .membership import RecruiterProfile


class AppendOnlyCompanyPageEventQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValueError('CompanyPageEvent là nhật ký bất biến.')

    def delete(self):
        raise ValueError('CompanyPageEvent là nhật ký bất biến.')


class CompanyPageEvent(models.Model):
    """Append-only trail of page changes that take effect without a review queue."""

    class EventType(models.TextChoices):
        POLICY_HOLD_APPLIED = 'policy_hold_applied', 'Đã tạm ẩn trang'
        POLICY_HOLD_RELEASED = 'policy_hold_released', 'Đã gỡ tạm ẩn trang'
        LAYOUT_UPDATED = 'layout_updated', 'Đã đổi bố cục trang'
        PINNED_JOBS_UPDATED = 'pinned_jobs_updated', 'Đã đổi tin ghim'
        EDITOR_GRANTED = 'editor_granted', 'Đã cấp quyền biên tập'
        EDITOR_REVOKED = 'editor_revoked', 'Đã thu hồi quyền biên tập'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='page_events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AppendOnlyCompanyPageEventQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['company', '-created_at'],
                name='emp_co_page_event_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError('CompanyPageEvent là nhật ký bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('cpe')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('CompanyPageEvent là nhật ký bất biến.')


class CompanyPageSettings(models.Model):
    """Layout an editor chose for a company page; no row means registry defaults.

    Kept off ``Company`` so saving a layout never moves ``Company.updated_at``,
    the optimistic-lock base of company update requests.
    """

    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='page_settings',
    )
    # Keys of ``employers.page_registry``; read through ``resolve_section_order``.
    section_order = models.JSONField(default=list, blank=True)
    hidden_sections = models.JSONField(default=list, blank=True)
    accent = models.CharField(max_length=32, default=DEFAULT_ACCENT_KEY)
    # Bumped by every layout or pinned-job change; clients send it back.
    lock_version = models.PositiveIntegerField(default=0)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.company_id} v{self.lock_version}'


class CompanyPinnedJob(models.Model):
    """A job the company keeps at the top of its page (at most three)."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='pinned_jobs')
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='company_pins')
    sort_order = models.PositiveSmallIntegerField()
    pinned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['company', 'job'], name='emp_co_pinned_job_unique'),
        ]

    def __str__(self):
        return f'{self.company_id}: {self.job_id} #{self.sort_order}'


class CompanyPageEditorGrant(models.Model):
    """The owner's delegation of page editing to one member, with its history.

    A grant alone gives nothing: ``models.page_access`` still requires the
    member and the owner to be eligible representatives at request time.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='page_editor_grants',
    )
    recruiter = models.ForeignKey(
        RecruiterProfile,
        on_delete=models.CASCADE,
        related_name='page_editor_grants',
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    revoke_reason = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ['-granted_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'recruiter'],
                condition=models.Q(revoked_at__isnull=True),
                name='emp_co_page_grant_active',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cpg')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.public_id}: {self.recruiter_id} @ {self.company_id}'
