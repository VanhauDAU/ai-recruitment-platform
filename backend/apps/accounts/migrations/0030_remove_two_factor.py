from django.db import migrations, models
from django.utils import timezone

# ADR-0016 removes two-factor authentication. TOTP secrets and backup-code
# hashes are dropped for good; the reset permission is retired the same way
# `sync_permission_catalog` retires a removed code.
RETIRED_PERMISSION_CODES = ('account.mfa.reset',)
RETIRED_EMAIL_KINDS = ('two_factor', 'mfa_reset_notice')


def retire_two_factor(apps, schema_editor):
    apps.get_model('accounts', 'AuthEmailJob').objects.filter(
        kind__in=RETIRED_EMAIL_KINDS
    ).delete()
    apps.get_model('accounts', 'AdminPermission').objects.filter(
        code__in=RETIRED_PERMISSION_CODES,
        is_active=True,
    ).update(is_active=False, deprecated_at=timezone.now())


class Migration(migrations.Migration):
    dependencies = [('accounts', '0029_retire_commercial_service_permissions')]

    operations = [
        migrations.RunPython(retire_two_factor, migrations.RunPython.noop),
        migrations.RemoveField(model_name='user', name='two_factor_enabled'),
        migrations.RemoveField(model_name='user', name='two_factor_email_enabled'),
        migrations.RemoveField(model_name='user', name='two_factor_totp_secret'),
        migrations.RemoveField(model_name='user', name='two_factor_backup_code_hashes'),
        migrations.AlterField(
            model_name='authemailjob',
            name='kind',
            field=models.CharField(
                choices=[
                    ('verification', 'Email verification'),
                    ('welcome', 'Welcome email'),
                    ('password_reset', 'Password reset'),
                    ('admin_invitation', 'Admin invitation'),
                    ('email_changed_notice', 'Email changed security notice'),
                    ('account_status_notice', 'Account status security notice'),
                ],
                max_length=30,
            ),
        ),
    ]
