"""CVT-1a: ngôn ngữ CV giới hạn theo `CvLanguage` (tiếng Việt/Anh)."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('cvs', '0010_cvasset'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usercv',
            name='language',
            field=models.CharField(
                choices=[('vi-VN', 'Tiếng Việt'), ('en-US', 'Tiếng Anh')],
                default='vi-VN',
                max_length=16,
            ),
        ),
    ]
