from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0024_company_tax_lookup_evidence'),
    ]

    operations = [
        migrations.AlterField(
            model_name='company',
            name='tax_code',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddConstraint(
            model_name='company',
            constraint=models.UniqueConstraint(
                condition=models.Q(('verification_status', 'verified')),
                fields=('tax_code',),
                name='uniq_verified_company_tax_code',
            ),
        ),
    ]
