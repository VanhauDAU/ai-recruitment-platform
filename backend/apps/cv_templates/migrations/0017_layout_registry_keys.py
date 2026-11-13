"""CVT-2: khóa renderer cũ đổi sang khóa layout mới cùng vùng.

Ba renderer cũ có đúng vùng của layout mới tương ứng nên CV đang ghim các
version này vẫn hợp lệ, chỉ hiển thị bằng renderer chung mới. `.update()` bỏ
qua chặn sửa version đã publish vì đây là đổi tên khóa, không đổi hợp đồng vùng.
"""

from django.db import migrations

RENAMES = {
    'classic_single_column_v1': 'single_column_v1',
    'classic_two_column_v1': 'sidebar_right_v1',
    'header_two_column_v1': 'header_band_two_column_v1',
}


def forwards(apps, schema_editor):
    CvTemplateVersion = apps.get_model('cv_templates', 'CvTemplateVersion')
    for old, new in RENAMES.items():
        CvTemplateVersion.objects.filter(renderer_key=old).update(renderer_key=new)


def backwards(apps, schema_editor):
    CvTemplateVersion = apps.get_model('cv_templates', 'CvTemplateVersion')
    for old, new in RENAMES.items():
        CvTemplateVersion.objects.filter(renderer_key=new).update(renderer_key=old)


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0016_remove_cvtemplate_legacy_fields'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
