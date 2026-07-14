# Generated manually for the CV Builder catalog rollout.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cv_templates', '0002_architecture_foundation'),
        ('jobs', '0016_job_company_final'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CvSampleContent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('locale', models.CharField(max_length=16)),
                ('experience_level', models.CharField(default='unspecified', max_length=30)),
                ('title', models.CharField(max_length=255)),
                ('content_json', models.JSONField(default=dict)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft', max_length=20)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_cv_sample_contents', to=settings.AUTH_USER_MODEL)),
                ('job_category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cv_sample_contents', to='jobs.jobcategory')),
            ],
            options={
                'ordering': ['locale', 'experience_level', 'title'],
            },
        ),
        migrations.AddIndex(
            model_name='cvsamplecontent',
            index=models.Index(fields=['status', 'locale', 'experience_level'], name='idx_cv_samples_catalog'),
        ),
    ]
