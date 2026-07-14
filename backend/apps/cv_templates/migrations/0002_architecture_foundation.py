"""Expand and backfill the versioned template foundation.

The legacy template columns remain untouched for dual-read compatibility.  The
backfill is idempotent so it is safe to retry after an interrupted deployment.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_template_foundation(apps, schema_editor):
    CvTemplate = apps.get_model('cv_templates', 'CvTemplate')
    CvCategory = apps.get_model('cv_templates', 'CvCategory')
    CvTemplateVersion = apps.get_model('cv_templates', 'CvTemplateVersion')
    CvTemplateLocalization = apps.get_model('cv_templates', 'CvTemplateLocalization')
    CvTemplateCategoryLink = apps.get_model('cv_templates', 'CvTemplateCategoryLink')
    CvSectionDefinition = apps.get_model('cv_templates', 'CvSectionDefinition')

    sections = (
        ('summary', 'Giới thiệu', False, False),
        ('experience', 'Kinh nghiệm làm việc', True, True),
        ('education', 'Học vấn', True, True),
        ('skills', 'Kỹ năng', False, True),
        ('projects', 'Dự án', True, True),
        ('certifications', 'Chứng chỉ', True, True),
        ('languages', 'Ngôn ngữ', False, True),
        ('awards', 'Giải thưởng', True, True),
        ('custom', 'Nội dung tùy chỉnh', True, False),
    )
    for key, name, allow_multiple, item_id_required in sections:
        CvSectionDefinition.objects.get_or_create(
            section_key=key,
            defaults={
                'display_name': name,
                'data_schema': {'schema_version': 1, 'item_id_required': item_id_required},
                'allow_multiple': allow_multiple,
                'is_system': True,
                'is_active': True,
                'schema_version': 1,
            },
        )

    default_layout = {
        'schema_version': 1,
        'page': {'size': 'A4', 'margin_mm': 12},
        'regions': [{'id': 'main', 'width_percent': 100, 'section_instance_ids': []}],
    }
    default_style = {
        'schema_version': 1,
        'theme_color': '#00A66A',
        'font_family': 'Roboto',
        'font_scale': 1.0,
        'line_height': 1.4,
        'background_asset_id': None,
        'section_overrides': {},
    }
    for template in CvTemplate.objects.all().iterator():
        published = template.status == 'active'
        version, _ = CvTemplateVersion.objects.get_or_create(
            template_id=template.pk,
            version_number=1,
            defaults={
                'version_status': 'published' if published else 'retired',
                'renderer_key': 'classic_single_column_v1',
                'renderer_version': '1',
                'schema_version': 1,
                'layout_schema': {'schema_version': 1},
                'style_schema': {'schema_version': 1},
                'default_layout_json': template.layout_config if isinstance(template.layout_config, dict) and template.layout_config.get('schema_version') == 1 else default_layout,
                'default_style_json': template.style_config if isinstance(template.style_config, dict) and template.style_config.get('schema_version') == 1 else default_style,
                'capabilities': {'supports_regions': ['main']},
                'content_contract': {'schema': 'canonical_cv_content_v1', 'schema_version': 1},
                'created_by_id': template.created_by_id,
            },
        )
        CvTemplateLocalization.objects.get_or_create(
            template_id=template.pk,
            locale='vi-VN',
            defaults={'display_name': template.name, 'description': template.description},
        )
        if template.category:
            raw_category = template.category.strip()
            category_type = 'style' if raw_category.lower() in {'simple', 'modern', 'classic'} else 'position'
            slug = raw_category.lower().replace(' ', '-')[:140]
            category, _ = CvCategory.objects.get_or_create(
                category_type=category_type,
                slug=slug,
                defaults={
                    'public_id': f'cvcat-migrated-{category_type}-{slug}'[:50],
                    'name': raw_category,
                },
            )
            CvTemplateCategoryLink.objects.get_or_create(template_id=template.pk, category_id=category.pk)
        template.lifecycle_status = 'published' if published else 'archived'
        template.current_published_version_id = version.pk if published else None
        template.save(update_fields=['lifecycle_status', 'current_published_version'])


class Migration(migrations.Migration):

    dependencies = [
        ('cv_templates', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='cvtemplate',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='cvtemplate',
            name='lifecycle_status',
            field=models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft', max_length=20),
        ),
        migrations.CreateModel(
            name='CvCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('category_type', models.CharField(choices=[('style', 'Style'), ('feature', 'Feature'), ('position', 'Position'), ('audience', 'Audience')], max_length=30)),
                ('name', models.CharField(max_length=120)),
                ('slug', models.SlugField(max_length=140)),
                ('description', models.TextField(blank=True)),
                ('sort_order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['category_type', 'sort_order', 'name']},
        ),
        migrations.CreateModel(
            name='CvSectionDefinition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('section_key', models.CharField(max_length=80, unique=True)),
                ('display_name', models.CharField(max_length=120)),
                ('data_schema', models.JSONField(default=dict)),
                ('allow_multiple', models.BooleanField(default=False)),
                ('is_system', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='CvTemplateVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version_number', models.PositiveIntegerField()),
                ('version_status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('retired', 'Retired')], default='draft', max_length=20)),
                ('renderer_key', models.CharField(max_length=100)),
                ('renderer_version', models.CharField(default='1', max_length=50)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('layout_schema', models.JSONField(blank=True, default=dict)),
                ('style_schema', models.JSONField(blank=True, default=dict)),
                ('default_layout_json', models.JSONField(blank=True, default=dict)),
                ('default_style_json', models.JSONField(blank=True, default=dict)),
                ('capabilities', models.JSONField(blank=True, default=dict)),
                ('content_contract', models.JSONField(blank=True, default=dict)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('retired_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_cv_template_versions', to=settings.AUTH_USER_MODEL)),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='cv_templates.cvtemplate')),
            ],
            options={'ordering': ['template_id', '-version_number']},
        ),
        migrations.CreateModel(
            name='CvTemplateLocalization',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('locale', models.CharField(max_length=16)),
                ('display_name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('seo_title', models.CharField(blank=True, max_length=255)),
                ('seo_description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='localizations', to='cv_templates.cvtemplate')),
            ],
        ),
        migrations.CreateModel(
            name='CvTemplateCategoryLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(default=0)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='template_links', to='cv_templates.cvcategory')),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='category_links', to='cv_templates.cvtemplate')),
            ],
        ),
        migrations.CreateModel(
            name='CvTemplateSection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('region_key', models.CharField(max_length=80)),
                ('default_order', models.IntegerField(default=0)),
                ('is_required', models.BooleanField(default=False)),
                ('is_default_enabled', models.BooleanField(default=True)),
                ('is_draggable', models.BooleanField(default=True)),
                ('use_theme_color', models.BooleanField(default=True)),
                ('config_json', models.JSONField(blank=True, default=dict)),
                ('section_definition', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='template_sections', to='cv_templates.cvsectiondefinition')),
                ('template_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sections', to='cv_templates.cvtemplateversion')),
            ],
        ),
        migrations.AddField(
            model_name='cvtemplate',
            name='current_published_version',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='cv_templates.cvtemplateversion'),
        ),
        migrations.AddConstraint(model_name='cvcategory', constraint=models.UniqueConstraint(fields=('category_type', 'slug'), name='uq_cv_categories_type_slug')),
        migrations.AddConstraint(model_name='cvtemplateversion', constraint=models.UniqueConstraint(fields=('template', 'version_number'), name='uq_cv_template_version')),
        migrations.AddConstraint(model_name='cvtemplateversion', constraint=models.CheckConstraint(condition=models.Q(('version_number__gt', 0)), name='chk_cv_template_version_number')),
        migrations.AddIndex(model_name='cvtemplateversion', index=models.Index(fields=['template', 'version_status', '-version_number'], name='idx_tpl_version_published')),
        migrations.AddConstraint(model_name='cvtemplatelocalization', constraint=models.UniqueConstraint(fields=('template', 'locale'), name='uq_cv_template_locale')),
        migrations.AddConstraint(model_name='cvtemplatecategorylink', constraint=models.UniqueConstraint(fields=('template', 'category'), name='uq_cv_template_category_link')),
        migrations.AddConstraint(model_name='cvtemplatesection', constraint=models.UniqueConstraint(fields=('template_version', 'section_definition', 'region_key'), name='uq_template_version_section')),
        migrations.RunPython(backfill_template_foundation, migrations.RunPython.noop),
    ]
