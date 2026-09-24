import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0040_recruiter_dpa_grace'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployerCompanyLinkEvent',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                (
                    'event_type',
                    models.CharField(
                        choices=[('admin_unlinked', 'Admin gỡ liên kết công ty')], max_length=32
                    ),
                ),
                ('reason', models.TextField()),
                ('impact_snapshot', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'actor',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'company',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='+',
                        to='employers.company',
                    ),
                ),
                (
                    'recruiter',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='company_link_events',
                        to='employers.recruiterprofile',
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(
                        fields=['recruiter', '-created_at'], name='emp_link_event_actor_time_idx'
                    )
                ],
            },
        ),
    ]
