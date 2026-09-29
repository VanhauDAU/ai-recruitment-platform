from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0032_backfill_employer_sms_challenges'),
    ]

    operations = [
        migrations.AlterField(
            model_name='phoneotp',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
    ]
