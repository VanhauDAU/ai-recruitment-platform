from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0042_employeractivity_employernotification'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployerNotificationPreference',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('intermediate_verification_email', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'recipient',
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name='employer_notification_preference',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name='employerverificationnotification',
            name='dedupe_key',
            field=models.CharField(blank=True, max_length=160, null=True),
        ),
        migrations.AddConstraint(
            model_name='employerverificationnotification',
            constraint=models.UniqueConstraint(
                condition=models.Q(dedupe_key__isnull=False),
                fields=('recipient', 'dedupe_key'),
                name='uniq_emp_verify_notice_dedupe',
            ),
        ),
    ]
