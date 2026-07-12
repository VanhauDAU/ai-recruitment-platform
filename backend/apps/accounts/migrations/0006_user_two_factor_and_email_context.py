# Generated manually for email-based two-factor authentication.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('accounts', '0005_migrate_social_accounts_remove_legacy_provider')]

    operations = [
        migrations.AddField(
            model_name='user',
            name='two_factor_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='authemailjob',
            name='context',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name='authemailjob',
            name='kind',
            field=models.CharField(
                choices=[
                    ('verification', 'Email verification'),
                    ('password_reset', 'Password reset'),
                    ('two_factor', 'Two-factor authentication code'),
                ],
                max_length=30,
            ),
        ),
    ]
