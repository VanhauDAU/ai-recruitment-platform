import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('cvs', '0007_cv_draft_document_hash'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name='CvImportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('idempotency_key', models.CharField(max_length=100)),
                ('file_checksum_sha256', models.CharField(max_length=64)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='queued', max_length=20)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('failure_code', models.CharField(blank=True, max_length=80)),
                ('queued_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('failed_at', models.DateTimeField(blank=True, null=True)),
                ('source_expires_at', models.DateTimeField()),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('cv', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='import_job', to='cvs.usercv')),
                ('result_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='cvs.cvversion')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cv_import_jobs', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name='cvimportjob',
            constraint=models.UniqueConstraint(fields=('user', 'idempotency_key'), name='uq_cv_import_user_idempotency'),
        ),
        migrations.AddIndex(
            model_name='cvimportjob',
            index=models.Index(fields=['status', 'queued_at'], name='idx_cv_import_pending'),
        ),
        migrations.AddIndex(
            model_name='cvimportjob',
            index=models.Index(fields=['source_expires_at'], name='idx_cv_import_expiry'),
        ),
    ]
