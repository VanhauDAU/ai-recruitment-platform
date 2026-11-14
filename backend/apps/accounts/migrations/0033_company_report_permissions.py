from django.db import migrations

PERMISSIONS = (
    {
        'code': 'company_report.view',
        'module': 'company',
        'label': 'Xem báo cáo trang công ty',
        'description': 'Xem hàng chờ báo cáo trang công ty, người báo cáo và lịch sử kết luận.',
    },
    {
        'code': 'company_report.resolve',
        'module': 'company',
        'label': 'Xử lý báo cáo trang công ty',
        'description': 'Xác nhận, bác bỏ hoặc mở lại báo cáo trang công ty; tạm ẩn trang khi kết luận cần thêm quyền tạm ẩn trang công ty.',
    },
)


def seed_company_report_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    role_model = apps.get_model('accounts', 'AdminRole')
    permissions = [
        permission_model.objects.update_or_create(
            code=item['code'],
            defaults={
                'module': item['module'],
                'label': item['label'],
                'description': item['description'],
                'is_active': True,
                'deprecated_at': None,
            },
        )[0]
        for item in PERMISSIONS
    ]
    # Same role that may hide a public page: a report names its reporter and
    # its resolution can lead to that hold, so staff do not receive either.
    managers = role_model.objects.filter(
        department__code='employer-operations',
        code='manager',
        is_system_managed=True,
    )
    for role in managers:
        role.permissions.add(*permissions)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0032_company_page_moderation_permission')]

    operations = [
        migrations.RunPython(seed_company_report_permissions, migrations.RunPython.noop),
    ]
