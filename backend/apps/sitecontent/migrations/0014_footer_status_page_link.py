"""Thêm link "Trạng thái hệ thống" (Status page UptimeRobot) vào cụm footer "Về ProCV".

Seed chỉ tạo link khi cụm mới được tạo, nên DB đã có cụm cần migration này.
Production tắt Django admin, sau này đổi URL thì sửa bằng migration khác.
"""

from django.db import migrations

GROUP_KEY = 'footer-about'
LABEL = 'Trạng thái hệ thống'
URL = 'https://stats.uptimerobot.com/9L5zTlhKdh'


def forwards(apps, schema_editor):
    LinkGroup = apps.get_model('sitecontent', 'LinkGroup')
    LinkItem = apps.get_model('sitecontent', 'LinkItem')
    group = LinkGroup.objects.filter(key=GROUP_KEY).first()
    if group is None or group.items.filter(url=URL).exists():
        return
    last = group.items.order_by('-order').values_list('order', flat=True).first()
    LinkItem.objects.create(group=group, label=LABEL, url=URL, order=(last or 0) + 1)


def backwards(apps, schema_editor):
    LinkItem = apps.get_model('sitecontent', 'LinkItem')
    LinkItem.objects.filter(group__key=GROUP_KEY, url=URL).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('sitecontent', '0013_vietnamese_frontend_paths'),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
