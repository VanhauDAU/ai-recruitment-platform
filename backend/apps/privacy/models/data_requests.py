from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id


class DataSubjectRequest(models.Model):
    """Yêu cầu của chủ thể dữ liệu (Nghị định 13/2023): xóa tài khoản hoặc xuất dữ liệu.

    Người dùng gửi từ trang cài đặt tài khoản; quản trị viên xử lý trong hàng
    chờ. Bản ghi giữ lại sau khi xóa tài khoản làm bằng chứng đã đáp ứng yêu
    cầu: ``user`` trỏ tới tài khoản đã ẩn danh hóa nên không còn dữ liệu cá nhân.
    """

    class Kind(models.TextChoices):
        ERASURE = 'erasure', gettext_lazy('Xóa tài khoản')
        EXPORT = 'export', gettext_lazy('Xuất dữ liệu')

    class Status(models.TextChoices):
        PENDING = 'pending', gettext_lazy('Chờ xử lý')
        COMPLETED = 'completed', gettext_lazy('Đã xử lý')
        REJECTED = 'rejected', gettext_lazy('Từ chối')
        CANCELLED = 'cancelled', gettext_lazy('Đã hủy')

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='data_subject_requests',
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    note = models.TextField(blank=True)
    resolution_note = models.TextField(blank=True)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    handled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'kind'],
                condition=Q(status='pending'),
                name='uq_dsr_one_pending_per_kind',
            ),
            models.CheckConstraint(
                condition=Q(kind__in=['erasure', 'export']), name='chk_dsr_kind'
            ),
            models.CheckConstraint(
                condition=Q(status__in=['pending', 'completed', 'rejected', 'cancelled']),
                name='chk_dsr_status',
            ),
        ]
        indexes = [models.Index(fields=['status', 'created_at'], name='dsr_status_created_idx')]

    def __str__(self):
        return f'{self.public_id}:{self.kind}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('dsr')
        super().save(*args, **kwargs)
