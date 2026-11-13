from django.db import migrations


def remove_job_auto_approve_setting(apps, schema_editor):
    # The setting was never read by the application and post-moderation
    # (ADR-0014) makes every published job public without approval.
    apps.get_model('sitecontent', 'SiteSetting').objects.filter(key='job_auto_approve').delete()


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0020_employer_badge_setting_constraints')]

    operations = [
        migrations.RunPython(remove_job_auto_approve_setting, migrations.RunPython.noop),
    ]
