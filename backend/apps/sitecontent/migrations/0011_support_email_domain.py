"""Đổi email hỗ trợ mặc định cũ (tên dự án trước) sang tên miền procv.site.

Seed không ghi đè giá trị đã có, nên DB tạo từ seed cũ (kể cả dump từ dev nạp lên
production) vẫn giữ địa chỉ không ai nhận. Chỉ đổi khi còn đúng giá trị mặc định cũ.
"""

from django.db import migrations

OLD = 'support@aicareercoach.vn'
NEW = 'support@procv.site'


def forwards(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    SiteSetting.objects.filter(key='support_email', value=OLD).update(value=NEW)


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0010_legal_default_urls')]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
