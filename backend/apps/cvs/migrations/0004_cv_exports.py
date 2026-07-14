"""Expand immutable CV PDF export jobs and private artifacts.

This is an additive Expand migration.  Existing CVs, drafts, versions and
legacy ``pdf_url`` values remain untouched while V2 export reads exclusively
from ``CvVersion``.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cvs', '0003_cv_shared_links_and_access_logs'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CvExport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('export_format', models.CharField(choices=[('pdf', 'PDF')], default='pdf', max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('renderer_key', models.CharField(max_length=100)),
                ('renderer_version', models.CharField(max_length=50)),
                ('render_config', models.JSONField(default=dict)),
                ('render_config_hash', models.CharField(max_length=64)),
                ('storage_key', models.TextField(blank=True)),
                ('file_size_bytes', models.BigIntegerField(blank=True, null=True)),
                ('checksum_sha256', models.CharField(blank=True, max_length=64)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('last_error', models.TextField(blank=True)),
                ('queued_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('failed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cv', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='exports', to='cvs.usercv')),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_cv_exports', to=settings.AUTH_USER_MODEL)),
                ('version', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='exports', to='cvs.cvversion')),
            ],
        ),
        migrations.AddConstraint(
            model_name='cvexport',
            constraint=models.UniqueConstraint(fields=('version', 'render_config_hash'), name='uq_cv_export_version_render_config'),
        ),
        migrations.AddConstraint(
            model_name='cvexport',
            constraint=models.CheckConstraint(check=models.Q(('export_format__in', ['pdf'])), name='chk_cv_export_format'),
        ),
        migrations.AddConstraint(
            model_name='cvexport',
            constraint=models.CheckConstraint(check=models.Q(('status__in', ['pending', 'processing', 'completed', 'failed'])), name='chk_cv_export_status'),
        ),
        migrations.AddIndex(
            model_name='cvexport',
            index=models.Index(condition=models.Q(('status__in', ['pending', 'processing'])), fields=['status', 'queued_at'], name='idx_cv_exports_pending'),
        ),
        migrations.AddIndex(
            model_name='cvexport',
            index=models.Index(fields=['cv', '-created_at'], name='idx_cv_exports_cv_created'),
        ),
    ]
