from django.db import migrations

# ADR-0015: the `services` app is gone after `services.0012` dropped its tables.
# Remove what Django still remembers about it: content types (and, through
# them, auth permissions, their user/group grants and admin log entries) and
# the app's rows in django_migrations. Its tables are not touched here.
REMOVED_APP = 'services'


def forget_services_app(apps, schema_editor):
    content_type_model = apps.get_model('contenttypes', 'ContentType')
    content_type_model.objects.using(schema_editor.connection.alias).filter(
        app_label=REMOVED_APP
    ).delete()
    with schema_editor.connection.cursor() as cursor:
        cursor.execute('DELETE FROM django_migrations WHERE app = %s', [REMOVED_APP])


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0048_job_responsibility_acknowledgement'),
        ('admin', '0003_logentry_add_action_flag_choices'),
        ('auth', '0012_alter_user_first_name_max_length'),
        ('contenttypes', '0002_remove_content_type_name'),
    ]

    operations = [
        migrations.RunPython(forget_services_app, migrations.RunPython.noop),
    ]
