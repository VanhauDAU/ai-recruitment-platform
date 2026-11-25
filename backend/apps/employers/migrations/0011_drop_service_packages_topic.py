"""Bỏ chủ đề tư vấn "gói dịch vụ": nền tảng không còn gói nào (ADR-0015, ADR-0030)."""

from django.db import migrations

REMOVED_TOPIC = 'service_packages'


def drop_topic(apps, schema_editor):
    RecruitmentNeed = apps.get_model('employers', 'RecruitmentNeed')
    needs = RecruitmentNeed.objects.filter(consultation_topics__contains=[REMOVED_TOPIC])
    for need in needs.iterator():
        need.consultation_topics = [
            topic for topic in need.consultation_topics if topic != REMOVED_TOPIC
        ]
        need.save(update_fields=['consultation_topics'])


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0010_industry_is_active'),
    ]

    operations = [migrations.RunPython(drop_topic, migrations.RunPython.noop)]
