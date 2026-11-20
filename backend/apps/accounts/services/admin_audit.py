"""Ghi nhật ký thao tác quản trị dùng chung cho mọi domain."""

from ..models import AdminAccessAuditLog


def _audit(*, actor, source, actor_identifier, action, target_type, target_public_id, payload):
    return AdminAccessAuditLog.objects.create(
        actor=actor,
        source=source,
        actor_identifier=actor_identifier,
        action=action,
        target_type=target_type,
        target_public_id=target_public_id,
        payload=payload,
    )


def record_admin_self_action(user, action, payload=None):
    """Ghi nhật ký thao tác bảo mật do chính quản trị viên thực hiện.

    Gọi được từ các view dùng chung cho mọi cổng: no-op với tài khoản không phải
    admin nên không làm phình bảng audit bằng hoạt động của ứng viên/NTD.
    Payload chỉ chứa metadata không nhạy cảm (không mật khẩu, mã, token).
    """
    if not user or not user.is_authenticated or not user.is_admin_role:
        return None
    return _audit(
        actor=user,
        source='api',
        actor_identifier=user.email,
        action=action,
        target_type='user',
        target_public_id=user.public_id,
        payload=payload or {},
    )


def record_admin_action(
    *,
    actor,
    action,
    target_type,
    target_public_id,
    payload=None,
    source='api',
    actor_identifier='',
):
    """Public audit boundary for other domain services."""

    return AdminAccessAuditLog.objects.record(
        actor=actor,
        action=action,
        target_type=target_type,
        target_public_id=target_public_id,
        payload=payload,
        source=source,
        actor_identifier=actor_identifier,
    )
