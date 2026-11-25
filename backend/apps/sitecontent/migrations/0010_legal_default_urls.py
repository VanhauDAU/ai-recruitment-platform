"""Điền link Điều khoản / Chính sách quyền riêng tư ứng viên nếu đang để trống.

Seed không ghi đè giá trị đã có, nên DB tạo trước khi có hai bài pháp lý
(knowledgebase 0005) vẫn giữ chuỗi rỗng. Chỉ cập nhật key còn rỗng.
"""

from django.db import migrations

DEFAULTS = {
    'legal_terms_url': '/tro-giup/dieu-khoan-va-chinh-sach/dieu-khoan-su-dung',
    'legal_privacy_url': '/tro-giup/dieu-khoan-va-chinh-sach/chinh-sach-quyen-rieng-tu',
}


def forwards(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    for key, value in DEFAULTS.items():
        SiteSetting.objects.filter(key=key, value='').update(value=value)


class Migration(migrations.Migration):
    dependencies = [
        ('sitecontent', '0009_undo_window_in_seconds'),
        ('knowledgebase', '0005_legal_articles'),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
