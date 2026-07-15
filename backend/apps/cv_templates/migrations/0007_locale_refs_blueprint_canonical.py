from copy import deepcopy

from django.db import migrations, models
import django.db.models.deletion


def rich_text(value):
    return {
        'format': 'rich_text_v1',
        'content': [{'type': 'paragraph', 'text': line} for line in value.split('\n') if line],
    }


def blueprint_document(item):
    return {
        'schema_version': 1,
        'locale': item.locale,
        'personal_info': {
            'full_name': '', 'headline': '{position}', 'email': '', 'phone': '',
            'address': '', 'avatar_asset_id': None, 'links': [],
        },
        'sections': [
            {
                'instance_id': 'summary_1', 'section_key': 'summary',
                'title': item.summary_title, 'enabled': True,
                'items': [{'item_id': 'summary_item_1', 'value': item.summary_template}],
            },
            {
                'instance_id': 'experience_1', 'section_key': 'experience',
                'title': item.experience_title, 'enabled': True,
                'items': [{
                    'item_id': 'experience_item_1', 'role': '{position}',
                    'company': item.experience_company, 'start_date': '2022-03',
                    'end_date': None,
                    'description': rich_text(item.experience_description_template),
                }],
            },
            {
                'instance_id': 'education_1', 'section_key': 'education',
                'title': item.education_title, 'enabled': True,
                'items': [{
                    'item_id': 'education_item_1', 'degree': item.education_degree,
                    'institution': item.education_institution, 'start_date': '2016-09',
                    'end_date': '2020-06', 'description': rich_text(item.education_description),
                }],
            },
            {
                'instance_id': 'skills_1', 'section_key': 'skills',
                'title': item.skills_title, 'enabled': True,
                'items': [
                    {'item_id': f'skills_item_{index + 1}', 'name': skill, 'level': ''}
                    for index, skill in enumerate(item.skill_templates or [])
                ],
            },
        ],
        'custom_fields': {},
    }


def backfill(apps, schema_editor):
    Locale = apps.get_model('sitecontent', 'Locale')
    valid_codes = set(Locale.objects.values_list('code', flat=True))
    for model_name in ('CvTemplateLocalization', 'CvSampleContent', 'CvContentBlueprint'):
        Model = apps.get_model('cv_templates', model_name)
        for item in Model.objects.filter(locale__in=valid_codes).iterator():
            item.locale_ref_id = item.locale
            fields = ['locale_ref']
            if model_name == 'CvContentBlueprint' and not item.content_json_template:
                item.content_json_template = blueprint_document(item)
                fields.append('content_json_template')
            item.save(update_fields=fields)


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0006_cv_content_blueprints'),
        ('jobs', '0019_jobcategorylocalization_locale_ref'),
        ('sitecontent', '0010_locale'),
    ]
    operations = [
        migrations.AddField(
            model_name='cvtemplatelocalization', name='locale_ref',
            field=models.ForeignKey(blank=True, db_column='locale_ref_code', null=True,
                on_delete=django.db.models.deletion.PROTECT, related_name='cv_template_localizations',
                to='sitecontent.locale', to_field='code'),
        ),
        migrations.AddField(
            model_name='cvsamplecontent', name='locale_ref',
            field=models.ForeignKey(blank=True, db_column='locale_ref_code', null=True,
                on_delete=django.db.models.deletion.PROTECT, related_name='cv_sample_contents',
                to='sitecontent.locale', to_field='code'),
        ),
        migrations.AddField(
            model_name='cvcontentblueprint', name='locale_ref',
            field=models.ForeignKey(blank=True, db_column='locale_ref_code', null=True,
                on_delete=django.db.models.deletion.PROTECT, related_name='cv_content_blueprints',
                to='sitecontent.locale', to_field='code'),
        ),
        migrations.AddField(
            model_name='cvcontentblueprint', name='content_json_template',
            field=models.JSONField(blank=True, default=dict,
                help_text='Canonical content template; strings may contain {position}.'),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
