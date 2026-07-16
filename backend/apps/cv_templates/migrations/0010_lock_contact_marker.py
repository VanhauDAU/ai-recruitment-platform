from django.db import migrations


def lock_contact_marker(apps, schema_editor):
    CvSectionDefinition = apps.get_model('cv_templates', 'CvSectionDefinition')
    definition = CvSectionDefinition.objects.filter(section_key='contact').first()
    if definition is None:
        return
    schema = {**(definition.data_schema or {}), 'deletable': False, 'personal_info_backed': True}
    CvSectionDefinition.objects.filter(pk=definition.pk).update(data_schema=schema)


class Migration(migrations.Migration):
    dependencies = [('cv_templates', '0009_wysiwyg_section_registry')]

    operations = [migrations.RunPython(lock_contact_marker, migrations.RunPython.noop)]
