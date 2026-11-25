from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0005_user_public_id_digits'),
    ]

    operations = [
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
                    ('password_setup_code', 'Password setup verification code'),
                ],
                max_length=30,
            ),
        ),
    ]
