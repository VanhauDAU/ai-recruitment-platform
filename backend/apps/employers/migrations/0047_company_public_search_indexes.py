import django.contrib.postgres.indexes
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('employers', '0046_company_public_search_trigram'),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='company',
            index=django.contrib.postgres.indexes.GinIndex(
                fields=['company_name_search'],
                name='idx_company_name_trgm',
                opclasses=['gin_trgm_ops'],
            ),
        ),
        AddIndexConcurrently(
            model_name='company',
            index=django.contrib.postgres.indexes.GinIndex(
                fields=['trade_name_search'],
                name='idx_trade_name_trgm',
                opclasses=['gin_trgm_ops'],
            ),
        ),
    ]
