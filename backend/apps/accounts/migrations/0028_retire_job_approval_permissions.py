from django.db import migrations
from django.utils import timezone

# Post-moderation (ADR-0014) has no approve/reject decision. The rows are kept
# as deprecated, exactly as `sync_permission_catalog` retires a removed code.
RETIRED_CODES = ('job_moderation.approve', 'job_moderation.reject')


def retire_job_approval_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    permission_model.objects.filter(code__in=RETIRED_CODES, is_active=True).update(
        is_active=False,
        deprecated_at=timezone.now(),
    )


class Migration(migrations.Migration):
    dependencies = [('accounts', '0027_employer_domain_permissions')]

    operations = [
        migrations.RunPython(retire_job_approval_permissions, migrations.RunPython.noop),
    ]
