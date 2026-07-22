from django.db import migrations, models
from django.utils.text import slugify

BENEFIT_GROUPS = {
    'allowance': ['Ăn trưa', 'Xăng xe', 'Trang điểm', 'Cước điện thoại'],
    'equipment': ['Điện thoại', 'Tai nghe', 'Máy tính'],
    'welfare': [
        'Bảo hiểm xã hội',
        'Bảo hiểm sức khỏe',
        'Bảo hiểm sức khỏe người thân',
        'Bảo hiểm full lương',
        'Khám sức khỏe định kỳ',
        'Team building',
        'Du lịch hàng năm',
        'Phụ cấp thâm niên',
        'Signing bonus',
        'ESOP',
        'Thưởng tháng 13',
        'Thưởng hiệu quả làm việc',
    ],
}


def seed_grouped_benefits(apps, schema_editor):
    Benefit = apps.get_model('jobs', 'Benefit')
    sort_order = 0
    for category, names in BENEFIT_GROUPS.items():
        for name in names:
            benefit, _ = Benefit.objects.get_or_create(name=name)
            benefit.category = category
            benefit.slug = benefit.slug or slugify(name)
            benefit.sort_order = sort_order
            benefit.is_active = True
            benefit.save(update_fields=['category', 'slug', 'sort_order', 'is_active'])
            sort_order += 1


def backfill_work_types(apps, schema_editor):
    Job = apps.get_model('jobs', 'Job')
    for job in Job.objects.exclude(work_type='').iterator(chunk_size=500):
        job.work_types = [job.work_type]
        job.save(update_fields=['work_types'])


class Migration(migrations.Migration):
    dependencies = [('jobs', '0024_job_income_display_type_alter_job_salary_type')]

    operations = [
        migrations.AddField(
            model_name='benefit',
            name='category',
            field=models.CharField(
                choices=[
                    ('allowance', 'Phụ cấp'),
                    ('equipment', 'Hỗ trợ thiết bị làm việc'),
                    ('welfare', 'Phúc lợi'),
                    ('other', 'Khác'),
                ],
                default='other',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='job',
            name='work_types',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Các hình thức làm việc được áp dụng; work_type giữ giá trị đầu tiên để tương thích bộ lọc cũ.',
            ),
        ),
        migrations.RunPython(seed_grouped_benefits, migrations.RunPython.noop),
        migrations.RunPython(backfill_work_types, migrations.RunPython.noop),
    ]
