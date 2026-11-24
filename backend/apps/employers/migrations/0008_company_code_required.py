from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('employers', '0007_company_code')]

    operations = [
        migrations.AlterField(
            model_name='company',
            name='code',
            field=models.CharField(editable=False, max_length=7, unique=True),
        ),
        migrations.AddConstraint(
            model_name='company',
            constraint=models.CheckConstraint(
                condition=models.Q(('code__regex', '^C[1-9][0-9]{5}$')),
                name='chk_companies_code_format',
            ),
        ),
    ]
