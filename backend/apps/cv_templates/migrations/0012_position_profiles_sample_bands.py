"""CVT-1b (bước 1): thêm `CvPositionProfile` và cột mới của nội dung mẫu."""

from django.db import migrations, models

DEFAULT_BAND = 'mid'
BAND_CHOICES = [
    ('entry', 'Dưới 1 năm'),
    ('junior', '1–2 năm'),
    ('mid', '3–4 năm'),
    ('senior', 'Từ 5 năm'),
]


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0011_cv_language_bilingual_templates'),
        ('jobs', '0050_job_category_localization_vi_en'),
    ]

    operations = [
        migrations.CreateModel(
            name='CvPositionProfile',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('section_preset', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'job_category',
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name='cv_position_profile',
                        to='jobs.jobcategory',
                    ),
                ),
            ],
            options={'ordering': ['sort_order', 'pk']},
        ),
        migrations.AddField(
            model_name='cvsamplecontent',
            name='position_profile',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name='sample_contents',
                to='cv_templates.cvpositionprofile',
            ),
        ),
        migrations.AddField(
            model_name='cvsamplecontent',
            name='experience_band',
            field=models.CharField(choices=BAND_CHOICES, default=DEFAULT_BAND, max_length=20),
            preserve_default=False,
        ),
    ]
