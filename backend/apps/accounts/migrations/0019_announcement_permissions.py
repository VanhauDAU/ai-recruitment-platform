from django.db import migrations

PERMISSIONS = (
    (
        'announcement.manage',
        'announcement',
        'Quản lý thông báo',
        'Tạo thông báo và revision nội dung trước khi phát hành.',
    ),
    (
        'announcement.publish',
        'announcement',
        'Phát hành thông báo',
        'Phát hành, lên lịch, tạm dừng, tiếp tục hoặc lưu trữ thông báo.',
    ),
    (
        'announcement.view',
        'announcement',
        'Xem thông báo',
        'Xem danh sách, nội dung, lịch sử revision và hiệu quả thông báo.',
    ),
)

ROLE_GRANTS = {
    'staff': ('announcement.view', 'announcement.manage'),
    'manager': (
        'announcement.view',
        'announcement.manage',
        'announcement.publish',
    ),
}


def seed_announcement_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    role_model = apps.get_model('accounts', 'AdminRole')
    permissions = {}
    for code, module, label, description in PERMISSIONS:
        permission, _ = permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': module,
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
        permissions[code] = permission

    roles = role_model.objects.filter(
        department__code='content-cv',
        code__in=ROLE_GRANTS,
        is_system_managed=True,
    )
    for role in roles:
        role.permissions.add(*(permissions[code] for code in ROLE_GRANTS[role.code]))


def keep_announcement_permissions(apps, schema_editor):
    # Permission, grant và audit liên quan là dữ liệu additive; rollback code
    # không xóa để một lần deploy lùi không làm mất lịch sử phân quyền.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0018_admin_employer_operations_permissions')]

    operations = [
        migrations.RunPython(
            seed_announcement_permissions,
            keep_announcement_permissions,
        ),
    ]
