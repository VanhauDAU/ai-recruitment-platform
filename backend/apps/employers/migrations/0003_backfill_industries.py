from django.db import migrations
from django.utils.text import slugify

# Chuyển industry (text đơn) -> industries (M2M). Giá trị "Đa ngành" giữ nguyên
# làm 1 Industry — không có cách suy luận tự động để tách thành nhiều lĩnh vực
# thật; admin có thể sửa lại cho từng công ty cụ thể sau khi migrate.


def backfill(apps, schema_editor):
    EmployerProfile = apps.get_model('employers', 'EmployerProfile')
    Industry = apps.get_model('employers', 'Industry')
    for profile in EmployerProfile.objects.exclude(industry='').only('id', 'industry'):
        name = profile.industry.strip()
        if not name:
            continue
        industry, _ = Industry.objects.get_or_create(name=name, defaults={'slug': slugify(name)})
        profile.industries.add(industry)


def reverse(apps, schema_editor):
    EmployerProfile = apps.get_model('employers', 'EmployerProfile')
    for profile in EmployerProfile.objects.all():
        first = profile.industries.first()
        if first:
            profile.industry = first.name
            profile.save(update_fields=['industry'])


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0002_add_industry_model'),
    ]

    operations = [
        migrations.RunPython(backfill, reverse),
    ]
