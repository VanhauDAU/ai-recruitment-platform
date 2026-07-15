from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('cv_templates', '0007_locale_refs_blueprint_canonical')]
    operations = [
        migrations.AddField(
            model_name='cvtemplatecolorlink', name='snapshot_fingerprint',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='cvtemplatecolorlink', name='snapshot_generated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
