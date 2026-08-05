from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('speech', '0003_singleflight_artifact_identity'),
    ]

    operations = [
        migrations.AddField(
            model_name='blogspeechasset',
            name='finalize_lease_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
