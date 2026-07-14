from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


def backfill_template_colors(apps, schema_editor):
    CvColor = apps.get_model('cv_templates', 'CvColor')
    CvTemplate = apps.get_model('cv_templates', 'CvTemplate')
    CvTemplateColorLink = apps.get_model('cv_templates', 'CvTemplateColorLink')

    for template in CvTemplate.objects.select_related('current_published_version').iterator():
        version = template.current_published_version
        style = version.default_style_json if version and isinstance(version.default_style_json, dict) else {}
        theme = style.get('theme_color', '#00A66A')
        variants = style.get('color_variants', [])
        values = [theme] + (variants if isinstance(variants, list) else [])
        seen = set()
        for index, raw_hex in enumerate(values):
            if not isinstance(raw_hex, str):
                continue
            hex_code = raw_hex.upper()
            if len(hex_code) != 7 or not hex_code.startswith('#') or hex_code in seen:
                continue
            seen.add(hex_code)
            color, _ = CvColor.objects.get_or_create(
                hex_code=hex_code,
                defaults={
                    'public_id': f'cvcolor-migrated-{hex_code[1:].lower()}',
                    'name': f'Màu {hex_code}',
                    'slug': f'color-{hex_code[1:].lower()}',
                    'sort_order': index,
                },
            )
            CvTemplateColorLink.objects.get_or_create(
                template_id=template.pk,
                color_id=color.pk,
                defaults={
                    'thumbnail_url': template.thumbnail_url,
                    'preview_url': template.preview_url or template.thumbnail_url,
                    'is_default': index == 0,
                    'sort_order': index,
                },
            )


class Migration(migrations.Migration):
    dependencies = [('cv_templates', '0003_cv_sample_content')]

    operations = [
        migrations.CreateModel(
            name='CvColor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('name', models.CharField(max_length=80)),
                ('slug', models.SlugField(max_length=100, unique=True)),
                ('hex_code', models.CharField(max_length=7, unique=True, validators=[django.core.validators.RegexValidator('^#[0-9A-Fa-f]{6}$', 'Use a six-digit hex color.')])),
                ('sort_order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['sort_order', 'name']},
        ),
        migrations.CreateModel(
            name='CvTemplateColorLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('thumbnail_url', models.TextField(blank=True)),
                ('preview_url', models.TextField(blank=True)),
                ('is_default', models.BooleanField(default=False)),
                ('sort_order', models.IntegerField(default=0)),
                ('color', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='template_links', to='cv_templates.cvcolor')),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='color_links', to='cv_templates.cvtemplate')),
            ],
            options={'ordering': ['sort_order', 'pk']},
        ),
        migrations.AddField(
            model_name='cvtemplate',
            name='categories',
            field=models.ManyToManyField(blank=True, related_name='templates', through='cv_templates.CvTemplateCategoryLink', to='cv_templates.cvcategory'),
        ),
        migrations.AddField(
            model_name='cvtemplate',
            name='colors',
            field=models.ManyToManyField(blank=True, related_name='templates', through='cv_templates.CvTemplateColorLink', to='cv_templates.cvcolor'),
        ),
        migrations.AddConstraint(
            model_name='cvtemplatecolorlink',
            constraint=models.UniqueConstraint(fields=('template', 'color'), name='uq_cv_template_color_link'),
        ),
        migrations.AddConstraint(
            model_name='cvtemplatecolorlink',
            constraint=models.UniqueConstraint(condition=models.Q(('is_default', True)), fields=('template',), name='uq_cv_template_default_color'),
        ),
        migrations.RunPython(backfill_template_colors, migrations.RunPython.noop),
    ]
