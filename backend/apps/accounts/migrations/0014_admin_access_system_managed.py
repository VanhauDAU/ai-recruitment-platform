from django.db import migrations, models


SYSTEM_DEPARTMENT_CODES = (
    'content-cv',
    'employer-services',
    'job-moderation',
)
SYSTEM_ROLE_CODES = ('staff', 'manager')


def mark_system_managed(apps, schema_editor):
    Department = apps.get_model('accounts', 'Department')
    AdminRole = apps.get_model('accounts', 'AdminRole')
    Department.objects.filter(code__in=SYSTEM_DEPARTMENT_CODES).update(is_system_managed=True)
    AdminRole.objects.filter(
        department__code__in=SYSTEM_DEPARTMENT_CODES,
        code__in=SYSTEM_ROLE_CODES,
    ).update(is_system_managed=True)


def clear_system_managed(apps, schema_editor):
    Department = apps.get_model('accounts', 'Department')
    AdminRole = apps.get_model('accounts', 'AdminRole')
    Department.objects.update(is_system_managed=False)
    AdminRole.objects.update(is_system_managed=False)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0013_admin_access'),
    ]

    operations = [
        migrations.AddField(
            model_name='department',
            name='is_system_managed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adminrole',
            name='is_system_managed',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_system_managed, clear_system_managed),
    ]
