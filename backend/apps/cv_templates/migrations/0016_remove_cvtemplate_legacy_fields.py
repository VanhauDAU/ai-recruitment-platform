"""CVT-1c (bước 2): gỡ cột legacy của `CvTemplate`.

Tách khỏi bước chép dữ liệu vì PostgreSQL không cho ALTER TABLE trong cùng
transaction với cập nhật dữ liệu còn trigger FK chờ xử lý.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0015_template_legacy_data'),
    ]

    operations = [
        migrations.RemoveField(model_name='cvtemplate', name=name)
        for name in (
            'category',
            'status',
            'layout_config',
            'style_config',
            'thumbnail_url',
            'preview_url',
        )
    ]
