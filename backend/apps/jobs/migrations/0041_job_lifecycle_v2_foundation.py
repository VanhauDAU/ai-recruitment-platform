from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0040_job_status_created_desc_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='first_approved_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Mốc duyệt đầu tiên bất biến của public cycle hiện tại.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='requested_visibility_days',
            field=models.PositiveSmallIntegerField(
                default=30,
                help_text='Số ngày công khai NTD yêu cầu cho public cycle hiện tại.',
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='visibility_ends_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='visibility_starts_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='job',
            index=models.Index(
                fields=['status', 'visibility_ends_at'],
                name='jobs_status_visibility_end_idx',
            ),
        ),
        migrations.AddConstraint(
            model_name='job',
            constraint=models.CheckConstraint(
                condition=Q(
                    requested_visibility_days__gte=1,
                    requested_visibility_days__lte=90,
                ),
                name='chk_jobs_visibility_days_range',
            ),
        ),
        migrations.AddConstraint(
            model_name='job',
            constraint=models.CheckConstraint(
                condition=(
                    Q(visibility_starts_at__isnull=True)
                    | Q(visibility_ends_at__isnull=True)
                    | Q(visibility_ends_at__gt=F('visibility_starts_at'))
                ),
                name='chk_jobs_visibility_window',
            ),
        ),
    ]
