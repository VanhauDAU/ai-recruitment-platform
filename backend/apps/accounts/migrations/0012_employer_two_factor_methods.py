from django.db import migrations, models


def carry_existing_email_mfa_forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(two_factor_enabled=True).update(two_factor_email_enabled=True)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0011_authsession_security')]

    operations = [
        migrations.AddField(
            model_name='user',
            name='two_factor_email_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='two_factor_totp_secret',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='two_factor_backup_code_hashes',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(carry_existing_email_mfa_forward, migrations.RunPython.noop),
    ]
