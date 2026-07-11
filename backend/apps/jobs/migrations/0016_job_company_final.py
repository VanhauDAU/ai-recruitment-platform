import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Chốt chuyển đổi: tin thuộc công ty (company NOT NULL), người đăng là
    posted_by; gỡ FK employer_profile cũ (bảng employer_profiles vẫn còn,
    gỡ ở Giai đoạn C)."""

    dependencies = [
        ('jobs', '0015_backfill_job_company'),
        ('employers', '0007_migrate_employer_profiles_to_companies'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveIndex(model_name='job', name='jobs_job_employe_da1c9a_idx'),
        migrations.RemoveIndex(model_name='job', name='jobs_job_employe_43f916_idx'),
        migrations.RemoveField(model_name='job', name='employer_profile'),
        migrations.RenameField(model_name='job', old_name='employer', new_name='posted_by'),
        migrations.AlterField(
            model_name='job',
            name='posted_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='posted_jobs',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='job',
            name='company',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='jobs',
                to='employers.company',
            ),
        ),
        migrations.AddIndex(
            model_name='job',
            index=models.Index(fields=['posted_by'], name='jobs_job_posted_by_idx'),
        ),
        migrations.AddIndex(
            model_name='job',
            index=models.Index(fields=['company', 'status', '-created_at'], name='jobs_job_company_status_idx'),
        ),
    ]
