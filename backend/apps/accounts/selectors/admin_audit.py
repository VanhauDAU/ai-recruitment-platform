"""Read models for the administrator audit log."""

from django.db.models import Max

from ..models import AdminAccessAuditLog


def current_audit_revision():
    """Mốc audit mới nhất; impact token mang mốc này để phát hiện preview cũ."""

    return AdminAccessAuditLog.objects.aggregate(value=Max('id'))['value'] or 0


def audit_logs_queryset(*, actor=None, action=None, target_type=None):
    """Nhật ký thao tác quản trị.

    ``actor=None`` trả toàn hệ thống — chỉ dành cho superuser; view phải tự kiểm
    quyền trước khi bỏ filter actor.
    """
    queryset = AdminAccessAuditLog.objects.select_related('actor')
    if actor is not None:
        queryset = queryset.filter(actor=actor)
    if action:
        queryset = queryset.filter(action=action)
    if target_type:
        queryset = queryset.filter(target_type=target_type)
    return queryset
