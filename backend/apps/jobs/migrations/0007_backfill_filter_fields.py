from django.db import migrations

# Suy ra kinh nghiệm (năm) + cấp bậc từ experience_level có sẵn để dữ liệu demo
# lọc được ngay; weekend_policy chia đều theo id (demo). Job mới nhập qua form/admin.
LEVEL_MAP = {
    'intern': ('none', 'intern'),
    'fresher': ('under_1', 'employee'),
    'junior': ('1', 'employee'),
    'middle': ('3', 'employee'),
    'senior': ('5', 'team_lead'),
}


def backfill(apps, schema_editor):
    Job = apps.get_model('jobs', 'Job')
    jobs = list(Job.objects.all())
    for job in jobs:
        years, level = LEVEL_MAP.get(job.experience_level, ('', ''))
        job.experience_years = years
        job.position_level = level
        job.weekend_policy = ['work_saturday', 'off_saturday', ''][job.id % 3]
    Job.objects.bulk_update(jobs, ['experience_years', 'position_level', 'weekend_policy'])


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0006_job_experience_years_job_position_level_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
