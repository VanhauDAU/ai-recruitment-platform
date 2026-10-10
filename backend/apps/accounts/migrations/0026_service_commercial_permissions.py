from django.db import migrations

PERMISSIONS = (
    {
        'code': 'service_audit.view',
        'module': 'service_audit',
        'label': 'Xem lịch sử dịch vụ',
        'description': 'Xem lịch sử phát hành, cấp, thu hồi và kích hoạt dịch vụ.',
    },
    {
        'code': 'service_catalog.draft.manage',
        'module': 'service_catalog',
        'label': 'Quản lý phiên bản nháp dịch vụ',
        'description': 'Tạo và chỉnh sửa quyền lợi có cấu trúc trước khi phát hành.',
    },
    {
        'code': 'service_catalog.publish',
        'module': 'service_catalog',
        'label': 'Phát hành phiên bản gói dịch vụ',
        'description': 'Khóa và phát hành một phiên bản quyền lợi thương mại mới.',
    },
    {
        'code': 'service_entitlement.manage',
        'module': 'service_entitlement',
        'label': 'Cấp và thu hồi lượt dịch vụ',
        'description': 'Cấp thủ công, thu hồi hoặc bù lượt dịch vụ cho doanh nghiệp.',
    },
    {
        'code': 'service_entitlement.view',
        'module': 'service_entitlement',
        'label': 'Xem kho lượt dịch vụ',
        'description': 'Xem lượt dịch vụ và trạng thái kích hoạt của doanh nghiệp.',
    },
)

ROLE_GRANTS = {
    'staff': ('service_audit.view', 'service_entitlement.view'),
    'manager': tuple(item['code'] for item in PERMISSIONS),
}


def seed_service_commercial_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    role_model = apps.get_model('accounts', 'AdminRole')
    permissions = {}
    for definition in PERMISSIONS:
        permission, _ = permission_model.objects.update_or_create(
            code=definition['code'],
            defaults={
                'module': definition['module'],
                'label': definition['label'],
                'description': definition['description'],
                'is_active': True,
                'deprecated_at': None,
            },
        )
        permissions[definition['code']] = permission

    roles = role_model.objects.filter(
        department__code='employer-services',
        code__in=ROLE_GRANTS,
        is_system_managed=True,
    )
    for role in roles:
        role.permissions.add(*(permissions[code] for code in ROLE_GRANTS[role.code]))


class Migration(migrations.Migration):
    dependencies = [('accounts', '0025_employer_company_unlink_permission')]

    operations = [
        migrations.RunPython(
            seed_service_commercial_permissions,
            migrations.RunPython.noop,
        )
    ]
