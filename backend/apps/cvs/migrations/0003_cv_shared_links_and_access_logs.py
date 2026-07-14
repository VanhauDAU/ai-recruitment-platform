"""Expand version-bound sharing and sensitive access auditing.

This migration is additive: existing CV/draft/version data remains untouched.
The raw bearer token is never a database column; only its SHA-256 hash is
persisted by the application service.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cvs', '0002_architecture_foundation'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CvSharedLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('token_hash', models.CharField(editable=False, max_length=64, unique=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('last_accessed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_cv_shared_links', to=settings.AUTH_USER_MODEL)),
                ('cv', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_links', to='cvs.usercv')),
                ('version', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='shared_links', to='cvs.cvversion')),
            ],
        ),
        migrations.CreateModel(
            name='CvAccessLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('actor_type', models.CharField(choices=[('owner', 'Owner'), ('recruiter', 'Recruiter'), ('admin', 'Admin'), ('anonymous', 'Anonymous')], max_length=30)),
                ('access_channel', models.CharField(choices=[('owner_view', 'Owner view'), ('application', 'Application'), ('admin', 'Admin'), ('shared_link', 'Shared link'), ('export', 'Export')], max_length=30)),
                ('ip_hash', models.CharField(blank=True, default='', max_length=64)),
                ('user_agent_hash', models.CharField(blank=True, default='', max_length=64)),
                ('accessed_at', models.DateTimeField(auto_now_add=True)),
                ('actor_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cv_access_logs', to=settings.AUTH_USER_MODEL)),
                ('cv', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='access_logs', to='cvs.usercv')),
                ('shared_link', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='access_logs', to='cvs.cvsharedlink')),
                ('version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='access_logs', to='cvs.cvversion')),
            ],
        ),
        migrations.AddIndex(
            model_name='cvsharedlink',
            index=models.Index(condition=models.Q(('revoked_at__isnull', True)), fields=['expires_at'], name='idx_cv_share_active_expiry'),
        ),
        migrations.AddIndex(
            model_name='cvsharedlink',
            index=models.Index(fields=['cv', '-created_at'], name='idx_cv_share_cv_created'),
        ),
        migrations.AddIndex(
            model_name='cvaccesslog',
            index=models.Index(fields=['cv', '-accessed_at'], name='idx_cv_access_cv_time'),
        ),
    ]
