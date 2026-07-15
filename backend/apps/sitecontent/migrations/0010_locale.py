from django.db import migrations, models
from django.db.models import Q


LOCALES = [
    ('vi-VN', 'Tiếng Việt', 'Tiếng Việt', '🇻🇳', 'mau-cv', True, 0),
    ('en-US', 'Tiếng Anh', 'English', '🇬🇧', 'mau-cv-tieng-anh', False, 10),
    ('ja-JP', 'Tiếng Nhật', '日本語', '🇯🇵', 'mau-cv-tieng-nhat', False, 20),
    ('zh-CN', 'Tiếng Trung', '简体中文', '🇨🇳', 'mau-cv-tieng-trung', False, 30),
]


def seed_locales(apps, schema_editor):
    Locale = apps.get_model('sitecontent', 'Locale')
    for code, label_vi, native_name, flag, path, is_default, sort_order in LOCALES:
        Locale.objects.update_or_create(
            code=code,
            defaults={
                'label_vi': label_vi,
                'native_name': native_name,
                'flag_emoji': flag,
                'catalog_path': path,
                'is_default': is_default,
                'is_active': True,
                'sort_order': sort_order,
            },
        )


class Migration(migrations.Migration):

    dependencies = [('sitecontent', '0009_alter_banner_placement')]

    operations = [
        migrations.CreateModel(
            name='Locale',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=16, unique=True)),
                ('label_vi', models.CharField(max_length=80)),
                ('native_name', models.CharField(max_length=80)),
                ('flag_emoji', models.CharField(blank=True, max_length=16)),
                ('catalog_path', models.SlugField(max_length=120, unique=True)),
                ('is_default', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['sort_order', 'label_vi', 'code']},
        ),
        migrations.AddConstraint(
            model_name='locale',
            constraint=models.UniqueConstraint(
                condition=Q(is_default=True),
                fields=('is_default',),
                name='uq_sitecontent_default_locale',
            ),
        ),
        migrations.RunPython(seed_locales, migrations.RunPython.noop),
    ]
