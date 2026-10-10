from django.db import migrations

PERMISSIONS = (
    {
        'code': 'employer_verification.revoke',
        'module': 'employer_verification',
        'label': 'Thu hồi xác thực nhà tuyển dụng',
        'description': 'Quyền Compliance Lead được gán tường minh để thu hồi hoặc đánh dấu hết hiệu lực xác thực.',
    },
    {
        'code': 'employer_verification.tax_override',
        'module': 'employer_verification',
        'label': 'Override bằng chứng tra cứu thuế',
        'description': 'Quyền Compliance Lead được gán tường minh để override bằng chứng thuế advisory kèm lý do.',
    },
)


def seed_high_risk_permissions_without_grants(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    for item in PERMISSIONS:
        permission_model.objects.update_or_create(
            code=item['code'],
            defaults={
                'module': item['module'],
                'label': item['label'],
                'description': item['description'],
                'is_active': True,
                'deprecated_at': None,
            },
        )


def keep_high_risk_permissions_and_grants(apps, schema_editor):
    # Security grants and their audit history must survive a code rollback.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0022_consultation_lead_export_permission')]

    operations = [
        migrations.RunPython(
            seed_high_risk_permissions_without_grants,
            keep_high_risk_permissions_and_grants,
        ),
    ]
