from django.db import migrations, models
from django.utils import timezone


def consolidate_active_memberships(apps, schema_editor):
    AdminMembership = apps.get_model('accounts', 'AdminMembership')
    now = timezone.now()
    user_ids = (
        AdminMembership.objects.filter(is_active=True)
        .values_list('user_id', flat=True)
        .distinct()
    )
    for user_id in user_ids.iterator():
        memberships = list(
            AdminMembership.objects.filter(user_id=user_id, is_active=True).order_by(
                '-is_primary', '-assigned_at', '-pk'
            )
        )
        if not memberships:
            continue
        retained, *replaced = memberships
        if replaced:
            AdminMembership.objects.filter(pk__in=[item.pk for item in replaced]).update(
                is_active=False,
                is_primary=False,
                revoked_at=now,
            )
        if not retained.is_primary:
            AdminMembership.objects.filter(pk=retained.pk).update(is_primary=True)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0014_admin_access_system_managed'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='adminmembership',
            name='uq_admin_membership_active_user_role',
        ),
        migrations.RemoveConstraint(
            model_name='adminmembership',
            name='uq_admin_membership_active_primary',
        ),
        migrations.AlterModelOptions(
            name='adminmembership',
            options={'ordering': ['-assigned_at', '-id']},
        ),
        migrations.RunPython(consolidate_active_memberships, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='adminmembership',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_active', True)),
                fields=('user',),
                name='uq_admin_membership_active_user',
            ),
        ),
    ]
