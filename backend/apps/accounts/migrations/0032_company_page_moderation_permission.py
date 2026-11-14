from django.db import migrations

PERMISSION = {
    'code': 'company_page.moderate',
    'module': 'company',
    'label': 'Tạm ẩn trang công ty',
    'description': 'Tạm ẩn hoặc khôi phục trang công ty công khai kèm lý do; trang bị ẩn trả 404 và rời danh bạ, sitemap.',
}


def seed_company_page_permission(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    role_model = apps.get_model('accounts', 'AdminRole')
    permission, _ = permission_model.objects.update_or_create(
        code=PERMISSION['code'],
        defaults={
            'module': PERMISSION['module'],
            'label': PERMISSION['label'],
            'description': PERMISSION['description'],
            'is_active': True,
            'deprecated_at': None,
        },
    )
    # Hiding a public page is a decision, so only the manager role receives it;
    # staff keep read-only access like the other employer-operations reviews.
    managers = role_model.objects.filter(
        department__code='employer-operations',
        code='manager',
        is_system_managed=True,
    )
    for role in managers:
        role.permissions.add(permission)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0031_cv_admin_permissions')]

    operations = [
        migrations.RunPython(seed_company_page_permission, migrations.RunPython.noop),
    ]
