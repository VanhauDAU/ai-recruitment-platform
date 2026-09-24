from django.db import migrations

PERMISSION = {
    'code': 'employer_verification.unlink_company',
    'module': 'employer_verification',
    'label': 'Gỡ liên kết công ty nhà tuyển dụng',
    'description': (
        'Quyền rủi ro cao để gỡ liên kết chọn nhầm khi tài khoản chưa phát sinh dữ liệu nghiệp vụ.'
    ),
}


def seed_permission(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    permission_model.objects.update_or_create(
        code=PERMISSION['code'],
        defaults={
            'module': PERMISSION['module'],
            'label': PERMISSION['label'],
            'description': PERMISSION['description'],
            'is_active': True,
            'deprecated_at': None,
        },
    )


class Migration(migrations.Migration):
    dependencies = [('accounts', '0024_employer_verification_resubmission_unlock_permission')]

    operations = [migrations.RunPython(seed_permission, migrations.RunPython.noop)]
