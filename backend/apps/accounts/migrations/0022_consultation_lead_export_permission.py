from django.db import migrations

PERMISSION = {
    'code': 'consultation_lead.export',
    'module': 'consultation_lead',
    'label': 'Xuất lead tư vấn',
    'description': 'Xuất danh sách lead tư vấn theo bộ lọc hiện tại với nhật ký audit.',
}


def seed_consultation_lead_export_permission(apps, schema_editor):
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
    manager = role_model.objects.filter(
        department__code='employer-services',
        code='manager',
        is_system_managed=True,
    ).first()
    if manager is not None:
        manager.permissions.add(permission)


def keep_consultation_lead_export_permission(apps, schema_editor):
    # Permission grants and export audit records must survive a code rollback.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0021_account_status_enforcement')]

    operations = [
        migrations.RunPython(
            seed_consultation_lead_export_permission,
            keep_consultation_lead_export_permission,
        ),
    ]
