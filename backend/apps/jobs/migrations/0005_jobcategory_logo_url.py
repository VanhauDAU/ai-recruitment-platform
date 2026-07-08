from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0004_jobcategory_icon_fields'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='jobcategory',
            name='icon_color',
        ),
        migrations.RemoveField(
            model_name='jobcategory',
            name='icon_key',
        ),
        migrations.AddField(
            model_name='jobcategory',
            name='logo_url',
            field=models.TextField(
                blank=True,
                help_text='Public URL for the category logo shown on the homepage.',
            ),
        ),
    ]
