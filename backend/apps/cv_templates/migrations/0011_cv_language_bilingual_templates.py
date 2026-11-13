"""CVT-1a: ngôn ngữ CV thành enum `CvLanguage`, tên/mô tả mẫu thành trường song ngữ.

Dữ liệu `CvTemplateLocalization` (vi-VN, en-US, đang bật) được chép vào các trường
`*_vi`/`*_en` trước khi xóa bảng; nội dung mẫu và blueprint tiếng Nhật/Trung bị
xóa vì sản phẩm không còn hỗ trợ hai ngôn ngữ này.
"""

from django.db import migrations, models

SUPPORTED = {'vi-VN': 'vi', 'en-US': 'en'}
LANGUAGE_CHOICES = [('vi-VN', 'Tiếng Việt'), ('en-US', 'Tiếng Anh')]
BILINGUAL_FIELDS = ('display_name', 'description', 'seo_title', 'seo_description')


def copy_localizations(apps, schema_editor):
    CvTemplate = apps.get_model('cv_templates', 'CvTemplate')
    CvTemplateLocalization = apps.get_model('cv_templates', 'CvTemplateLocalization')
    for template in CvTemplate.objects.all():
        localizations = CvTemplateLocalization.objects.filter(
            template=template, locale__in=SUPPORTED, is_active=True
        )
        for localization in localizations:
            suffix = SUPPORTED[localization.locale]
            for field in BILINGUAL_FIELDS:
                setattr(template, f'{field}_{suffix}', getattr(localization, field))
        if not template.description_vi:
            template.description_vi = template.description
        template.save()


def delete_unsupported_content(apps, schema_editor):
    for model_name in ('CvSampleContent', 'CvContentBlueprint'):
        apps.get_model('cv_templates', model_name).objects.exclude(locale__in=SUPPORTED).delete()


def _bilingual_field(name):
    if name in ('display_name', 'seo_title'):
        return models.CharField(blank=True, default='', max_length=255)
    return models.TextField(blank=True, default='')


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0010_lock_contact_marker'),
    ]

    operations = [
        *[
            migrations.AddField(
                model_name='cvtemplate',
                name=f'{field}_{suffix}',
                field=_bilingual_field(field),
                preserve_default=False,
            )
            for field in BILINGUAL_FIELDS
            for suffix in SUPPORTED.values()
        ],
        migrations.RunPython(copy_localizations, migrations.RunPython.noop),
        migrations.RunPython(delete_unsupported_content, migrations.RunPython.noop),
        migrations.RemoveField(model_name='cvtemplate', name='description'),
        migrations.DeleteModel(name='CvTemplateLocalization'),
        migrations.RemoveField(model_name='cvsamplecontent', name='locale_ref'),
        migrations.RemoveField(model_name='cvcontentblueprint', name='locale_ref'),
        migrations.AlterField(
            model_name='cvsamplecontent',
            name='locale',
            field=models.CharField(choices=LANGUAGE_CHOICES, max_length=16),
        ),
        migrations.AlterField(
            model_name='cvcontentblueprint',
            name='locale',
            field=models.CharField(choices=LANGUAGE_CHOICES, max_length=16),
        ),
    ]
