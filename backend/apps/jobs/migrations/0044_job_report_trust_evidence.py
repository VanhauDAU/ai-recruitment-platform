from django.db import migrations, models
import django.db.models.deletion


def backfill_report_subjects(apps, schema_editor):
    JobReport = apps.get_model('jobs', 'JobReport')
    reports = JobReport.objects.select_related('job').all().iterator(chunk_size=500)
    batch = []
    for report in reports:
        report.job_public_id_snapshot = report.job.public_id
        report.company_id_snapshot = report.job.company_id
        report.posted_by_id_snapshot = report.job.posted_by_id
        batch.append(report)
        if len(batch) >= 500:
            JobReport.objects.bulk_update(
                batch,
                ['job_public_id_snapshot', 'company_id_snapshot', 'posted_by_id_snapshot'],
            )
            batch = []
    if batch:
        JobReport.objects.bulk_update(
            batch,
            ['job_public_id_snapshot', 'company_id_snapshot', 'posted_by_id_snapshot'],
        )


class Migration(migrations.Migration):
    dependencies = [('jobs', '0043_job_application_reasons')]

    operations = [
        migrations.AddField(
            model_name='jobreport',
            name='company_id_snapshot',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='jobreport',
            name='job_public_id_snapshot',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='jobreport',
            name='posted_by_id_snapshot',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_report_subjects, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='jobreport',
            name='job',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='reports',
                to='jobs.job',
            ),
        ),
        migrations.AlterField(
            model_name='jobreportresolutionevent',
            name='report',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='resolution_history',
                to='jobs.jobreport',
            ),
        ),
        migrations.AddIndex(
            model_name='jobreport',
            index=models.Index(
                fields=['posted_by_id_snapshot', 'status', 'reason'],
                name='jobs_report_trust_idx',
            ),
        ),
    ]
