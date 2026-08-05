from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0025_allow_unverified_company_tax_code_duplicates'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='companydocument',
            name='uniq_current_verification_doc_type',
        ),
        migrations.AddConstraint(
            model_name='companydocument',
            constraint=models.UniqueConstraint(
                condition=(
                    models.Q(is_current=True, verification_case__isnull=False)
                    & ~models.Q(doc_type='identity_document')
                ),
                fields=('verification_case', 'doc_type'),
                name='uniq_current_single_verification_doc_type',
            ),
        ),
    ]
