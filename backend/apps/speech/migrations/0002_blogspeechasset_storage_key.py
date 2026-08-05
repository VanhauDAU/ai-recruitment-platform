from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('speech', '0001_initial')]

    operations = [
        migrations.AddField(
            model_name='blogspeechasset',
            name='storage_key',
            field=models.TextField(blank=True),
        ),
    ]
