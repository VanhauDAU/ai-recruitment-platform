from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cvs', '0005_active_default_cv_constraint'),
        ('jobs', '0017_jobcategory_public_id_localizations'),
    ]

    operations = [
        migrations.AddField(
            model_name='usercv',
            name='position',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='candidate_cvs', to='jobs.jobcategory'),
        ),
    ]
