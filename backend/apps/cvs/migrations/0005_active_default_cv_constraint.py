"""Enforce one active default CV per candidate before V2 metadata writes."""

from django.db import migrations, models


def retain_latest_default_cv(apps, schema_editor):
    UserCv = apps.get_model('cvs', 'UserCv')
    user_ids = (
        UserCv.objects.filter(is_default=True, is_deleted=False)
        .values_list('user_id', flat=True)
        .distinct()
    )
    for user_id in user_ids.iterator():
        default_ids = list(
            UserCv.objects.filter(user_id=user_id, is_default=True, is_deleted=False)
            .order_by('-updated_at', '-pk')
            .values_list('pk', flat=True)
        )
        if len(default_ids) > 1:
            UserCv.objects.filter(pk__in=default_ids[1:]).update(is_default=False)


class Migration(migrations.Migration):

    dependencies = [
        ('cvs', '0004_cv_exports'),
    ]

    operations = [
        migrations.RunPython(retain_latest_default_cv, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='usercv',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_default', True), ('is_deleted', False)),
                fields=('user',),
                name='uq_user_active_default_cv',
            ),
        ),
    ]
