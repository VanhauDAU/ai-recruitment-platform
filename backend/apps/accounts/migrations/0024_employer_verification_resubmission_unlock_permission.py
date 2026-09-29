from django.db import migrations

PERMISSION = {
    'code': 'employer_verification.resubmission_unlock',
    'module': 'employer_verification',
    'label': 'Mở khóa nộp lại xác thực nhà tuyển dụng',
    'description': 'Cho phép mở khóa ngoại lệ sau khi hồ sơ đạt giới hạn từ chối cuối, bắt buộc kèm lý do audit.',
}


def seed_permission_without_grants(apps, schema_editor):
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


def preserve_permission_and_audit_history(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0023_employer_verification_high_risk_permissions')]

    operations = [
        migrations.RunPython(
            seed_permission_without_grants,
            preserve_permission_and_audit_history,
        ),
    ]
