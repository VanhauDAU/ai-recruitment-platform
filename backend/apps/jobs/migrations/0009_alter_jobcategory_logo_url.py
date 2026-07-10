from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0008_unaccent_extension'),
    ]

    operations = [
        migrations.AlterField(
            model_name='jobcategory',
            name='logo_url',
            field=models.TextField(
                blank=True,
                help_text='Storage key nội bộ hoặc URL ngoài; API tự resolve storage key thành URL public.',
            ),
        ),
    ]
