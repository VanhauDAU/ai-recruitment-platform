from django.db import migrations
from django.utils import timezone

# ADR-0015 removes service packages and consultation leads. The rows are kept
# as deprecated, exactly as `sync_permission_catalog` retires a removed code.
RETIRED_CODES = (
    'consultation_lead.export',
    'consultation_lead.manage',
    'consultation_lead.view',
    'service_audit.view',
    'service_catalog.draft.manage',
    'service_catalog.manage',
    'service_catalog.publish',
    'service_catalog.view',
    'service_entitlement.manage',
    'service_entitlement.view',
)


def retire_commercial_service_permissions(apps, schema_editor):
    permission_model = apps.get_model('accounts', 'AdminPermission')
    permission_model.objects.filter(code__in=RETIRED_CODES, is_active=True).update(
        is_active=False,
        deprecated_at=timezone.now(),
    )


class Migration(migrations.Migration):
    dependencies = [('accounts', '0028_retire_job_approval_permissions')]

    operations = [
        migrations.RunPython(retire_commercial_service_permissions, migrations.RunPython.noop),
    ]
