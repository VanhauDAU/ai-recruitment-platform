"""CVT-1a: ngôn ngữ CV là enum `CvLanguage`, bảng Locale không còn consumer."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('sitecontent', '0021_remove_job_auto_approve_setting'),
        ('cv_templates', '0011_cv_language_bilingual_templates'),
        ('jobs', '0050_job_category_localization_vi_en'),
    ]

    operations = [
        migrations.DeleteModel(name='Locale'),
    ]
