import unicodedata

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations, models


def _fold_accents(value):
    value = (value or '').replace('đ', 'd').replace('Đ', 'D')
    return ''.join(
        character
        for character in unicodedata.normalize('NFD', value)
        if not unicodedata.combining(character)
    ).lower()


def _backfill_company_search_names(apps, schema_editor):
    Company = apps.get_model('employers', 'Company')
    batch = []
    for company in Company.objects.only('id', 'company_name', 'trade_name').iterator(
        chunk_size=1_000
    ):
        company.company_name_search = _fold_accents(company.company_name)
        company.trade_name_search = _fold_accents(company.trade_name)
        batch.append(company)
        if len(batch) == 1_000:
            Company.objects.bulk_update(
                batch,
                ['company_name_search', 'trade_name_search'],
                batch_size=1_000,
            )
            batch.clear()
    if batch:
        Company.objects.bulk_update(
            batch,
            ['company_name_search', 'trade_name_search'],
            batch_size=1_000,
        )


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0045_companydomainclaim_companydomainclaimevent_and_more'),
    ]

    operations = [
        TrigramExtension(),
        migrations.AddField(
            model_name='company',
            name='company_name_search',
            field=models.CharField(blank=True, default='', editable=False, max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='company',
            name='trade_name_search',
            field=models.CharField(blank=True, default='', editable=False, max_length=255),
            preserve_default=False,
        ),
        migrations.RunPython(
            _backfill_company_search_names,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
