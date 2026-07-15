from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0017_jobcategory_public_id_localizations'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobcategorylocalization',
            name='sort_order',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name='jobcategorylocalization',
            options={'ordering': ['locale', 'sort_order', 'display_name', 'category_id']},
        ),
        migrations.AddIndex(
            model_name='jobcategorylocalization',
            index=models.Index(
                fields=['locale', 'is_active', 'sort_order'],
                name='idx_jobcatloc_picker',
            ),
        ),
    ]
