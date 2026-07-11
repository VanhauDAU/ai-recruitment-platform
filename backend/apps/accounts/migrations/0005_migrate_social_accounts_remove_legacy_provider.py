from django.db import migrations


def migrate_legacy_social_accounts(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    SocialAccount = apps.get_model('accounts', 'SocialAccount')
    for user in User.objects.exclude(provider='local').exclude(provider_id=''):
        SocialAccount.objects.get_or_create(
            provider=user.provider,
            provider_user_id=user.provider_id,
            defaults={'user_id': user.pk, 'email': user.email},
        )


class Migration(migrations.Migration):
    dependencies = [('accounts', '0004_email_case_insensitive')]

    operations = [
        migrations.RunPython(migrate_legacy_social_accounts, migrations.RunPython.noop),
        migrations.RemoveField(model_name='user', name='provider_id'),
        migrations.RemoveField(model_name='user', name='provider'),
    ]
