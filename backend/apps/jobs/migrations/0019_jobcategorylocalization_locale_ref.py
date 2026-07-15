from django.db import migrations, models
import django.db.models.deletion


def backfill_locale_refs(apps, schema_editor):
    Localization = apps.get_model('jobs', 'JobCategoryLocalization')
    Locale = apps.get_model('sitecontent', 'Locale')
    valid_codes = set(Locale.objects.values_list('code', flat=True))
    for item in Localization.objects.filter(locale__in=valid_codes).iterator():
        item.locale_ref_id = item.locale
        item.save(update_fields=['locale_ref'])


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0018_jobcategorylocalization_sort_order'),
        ('sitecontent', '0010_locale'),
    ]
    operations = [
        migrations.AlterField(
            model_name='jobcategorylocalization',
            name='locale',
            field=models.CharField(max_length=16),
        ),
        migrations.AddField(
            model_name='jobcategorylocalization',
            name='locale_ref',
            field=models.ForeignKey(
                blank=True, db_column='locale_ref_code', null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='job_category_localizations',
                to='sitecontent.locale', to_field='code',
            ),
        ),
        migrations.RunPython(backfill_locale_refs, migrations.RunPython.noop),
    ]
