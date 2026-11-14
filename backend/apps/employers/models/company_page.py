"""History of changes that reach the public company page."""

from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from .company import Company


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
