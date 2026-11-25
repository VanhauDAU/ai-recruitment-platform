"""Quản trị danh mục lĩnh vực công ty."""

from apps.accounts.services import record_admin_action


def save_industry(*, actor, entry, **changes):
    """Tạo hoặc sửa một lĩnh vực đã được serializer kiểm tra trùng tên."""
    creating = entry.pk is None
    for field, value in changes.items():
        setattr(entry, field, value)
    entry.save()
    record_admin_action(
        actor=actor,
        action='industry.create' if creating else 'industry.update',
        target_type='Industry',
        target_public_id=str(entry.pk),
        payload={'fields': sorted(changes)},
    )
    return entry
