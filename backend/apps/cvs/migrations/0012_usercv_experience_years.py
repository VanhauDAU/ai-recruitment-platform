"""CVT-1c: trường matching `experience_years` (giá trị `Job.ExperienceYears`).

Điền cho CV hiện có từ version mới nhất, dùng đúng hàm thuần mà service dùng
khi tạo version để hai đường tính không lệch nhau.
"""

from django.db import migrations, models


def backfill(apps, schema_editor):
    from apps.cvs.services.matching_profile import experience_years

    UserCv = apps.get_model('cvs', 'UserCv')
    for cv in UserCv.objects.select_related('latest_version').exclude(latest_version=None):
        content = cv.latest_version.content_json
        if isinstance(content, dict):
            UserCv.objects.filter(pk=cv.pk).update(experience_years=experience_years(content))


class Migration(migrations.Migration):
    dependencies = [
        ('cvs', '0011_usercv_language_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='usercv',
            name='experience_years',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
