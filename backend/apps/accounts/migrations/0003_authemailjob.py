# Generated manually for the authentication email transactional outbox.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_user_provider_socialaccount'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuthEmailJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('verification', 'Email verification'), ('password_reset', 'Password reset')], max_length=30)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('sending', 'Sending'), ('sent', 'Sent'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('last_error', models.TextField(blank=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='auth_email_jobs', to='accounts.user')),
            ],
            options={
                'indexes': [models.Index(fields=['status', 'created_at'], name='auth_email_status_created_idx')],
            },
        ),
    ]
