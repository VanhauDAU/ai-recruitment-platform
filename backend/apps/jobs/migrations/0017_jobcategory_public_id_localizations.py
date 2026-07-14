import uuid

from django.db import migrations, models
import django.db.models.deletion


def backfill_public_ids_and_vi_names(apps, schema_editor):
    JobCategory = apps.get_model('jobs', 'JobCategory')
    JobCategoryLocalization = apps.get_model('jobs', 'JobCategoryLocalization')

    for category in JobCategory.objects.all().iterator():
        if not category.public_id:
            category.public_id = f'jobcat_{uuid.uuid4().hex[:12]}'
            category.save(update_fields=['public_id'])
        JobCategoryLocalization.objects.get_or_create(
            category_id=category.pk,
            locale='vi-VN',
            defaults={'display_name': category.name, 'is_active': True},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0016_job_company_final'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobcategory',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, null=True, unique=True),
        ),
        migrations.CreateModel(
            name='JobCategoryLocalization',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('locale', models.CharField(choices=[('vi-VN', 'Tiếng Việt'), ('en-US', 'Tiếng Anh'), ('ja-JP', 'Tiếng Nhật'), ('zh-CN', 'Tiếng Trung')], max_length=16)),
                ('display_name', models.CharField(max_length=255)),
                ('search_aliases', models.TextField(blank=True, help_text='Các từ khóa tìm kiếm, phân tách bằng dấu phẩy.')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='localizations', to='jobs.jobcategory')),
            ],
            options={'ordering': ['category_id', 'locale']},
        ),
        migrations.AddConstraint(
            model_name='jobcategorylocalization',
            constraint=models.UniqueConstraint(fields=('category', 'locale'), name='uq_job_category_localization'),
        ),
        migrations.RunPython(backfill_public_ids_and_vi_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='jobcategory',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
    ]
