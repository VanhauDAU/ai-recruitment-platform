import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0010_authsession')]

    operations = [
        migrations.AddField(
            model_name='authsession',
            name='auth_method',
            field=models.CharField(default='password', max_length=20),
        ),
        migrations.AddField(
            model_name='authsession',
            name='reauthenticated_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddConstraint(
            model_name='authsession',
            constraint=models.UniqueConstraint(
                fields=('refresh_jti',),
                name='uq_auth_session_refresh_jti',
            ),
        ),
    ]
