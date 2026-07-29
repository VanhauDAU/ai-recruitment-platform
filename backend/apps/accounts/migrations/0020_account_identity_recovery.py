from django.core.management.color import no_style
from django.db import migrations, models

RECOVERY_PERMISSIONS = (
    (
        'account.email.manage',
        'Khôi phục email đăng nhập',
        'Đổi email đăng nhập sau khi hoàn tất quy trình xác minh danh tính thủ công.',
    ),
    (
        'account.mfa.reset',
        'Đặt lại xác thực đa yếu tố',
        'Xóa các phương thức xác thực đa yếu tố sau khi xác minh danh tính thủ công.',
    ),
)


def seed_recovery_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    for code, label, description in RECOVERY_PERMISSIONS:
        permission_model.objects.update_or_create(
            code=code,
            defaults={
                'module': 'account',
                'label': label,
                'description': description,
                'is_active': True,
                'deprecated_at': None,
            },
        )
    for statement in schema_editor.connection.ops.sequence_reset_sql(
        no_style(),
        [permission_model],
    ):
        schema_editor.execute(statement)


def keep_recovery_permissions(apps, schema_editor):
    # Permission rows are audit-relevant configuration. Rollback must not
    # silently remove grants that may already have been assigned.
    return None


class Migration(migrations.Migration):
    dependencies = [('accounts', '0019_announcement_permissions')]

    operations = [
        migrations.AddField(
            model_name='user',
            name='auth_revision',
            field=models.PositiveBigIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='authsession',
            name='auth_revision',
            field=models.PositiveBigIntegerField(default=1),
        ),
        migrations.AlterField(
            model_name='authemailjob',
            name='kind',
            field=models.CharField(
                choices=[
                    ('verification', 'Email verification'),
                    ('welcome', 'Welcome email'),
                    ('password_reset', 'Password reset'),
                    ('two_factor', 'Two-factor authentication code'),
                    ('admin_invitation', 'Admin invitation'),
                    ('email_changed_notice', 'Email changed security notice'),
                    ('mfa_reset_notice', 'MFA reset security notice'),
                ],
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name='authemailjob',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('sending', 'Sending'),
                    ('sent', 'Sent'),
                    ('failed', 'Failed'),
                    ('cancelled', 'Cancelled'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.RunPython(seed_recovery_permissions, keep_recovery_permissions),
    ]
