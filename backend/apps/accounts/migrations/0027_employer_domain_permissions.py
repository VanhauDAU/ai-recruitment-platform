from django.db import migrations

PERMISSIONS = (
    {
        'code': 'employer_domain.view',
        'module': 'employer_domain',
        'label': 'Xem xác minh tên miền doanh nghiệp',
        'description': 'Xem hàng chờ và lịch sử xác minh tên miền công ty.',
    },
    {
        'code': 'employer_domain.review',
        'module': 'employer_domain',
        'label': 'Duyệt xác minh tên miền doanh nghiệp',
        'description': 'Duyệt hoặc từ chối yêu cầu xác minh tên miền thủ công.',
    },
    {
        'code': 'employer_domain.revoke',
        'module': 'employer_domain',
        'label': 'Thu hồi xác minh tên miền doanh nghiệp',
        'description': 'Quyền rủi ro cao để thu hồi quyền sở hữu tên miền công ty.',
    },
)


def seed_domain_permissions(apps, schema_editor):
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
        department__code='employer-operations',
        code__in=['staff', 'manager'],
        is_system_managed=True,
    )
    for role in roles:
        role.permissions.add(permissions['employer_domain.view'])
        if role.code == 'manager':
            role.permissions.add(permissions['employer_domain.review'])
    # Revoke intentionally receives no automatic grant. Compliance Lead or a
    # superuser must grant it explicitly, matching other high-risk permissions.


class Migration(migrations.Migration):
    dependencies = [('accounts', '0026_service_commercial_permissions')]

    operations = [
        migrations.RunPython(seed_domain_permissions, migrations.RunPython.noop),
    ]
