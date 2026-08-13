from django.db import migrations, models


def repair_quantity_activation_windows(apps, schema_editor):
    activation_model = apps.get_model('services', 'JobServiceActivation')
    item_model = apps.get_model('services', 'JobServiceActivationItem')

    activations = (
        activation_model.objects.filter(status='active')
        .select_related('job')
        .only('id', 'starts_at', 'ends_at', 'snapshot', 'job__visibility_ends_at')
    )
    for activation in activations.iterator(chunk_size=500):
        durationless_codes = {
            item.get('capability')
            for item in (activation.snapshot or {}).get('items', [])
            if item.get('duration_days') is None and item.get('capability')
        }
        if not durationless_codes:
            continue

        repaired_ends_at = activation.ends_at
        if repaired_ends_at <= activation.starts_at:
            job_ends_at = activation.job.visibility_ends_at
            if job_ends_at is None or job_ends_at <= activation.starts_at:
                continue
            repaired_ends_at = job_ends_at
            activation_model.objects.filter(pk=activation.pk).update(ends_at=repaired_ends_at)

        item_model.objects.filter(
            activation_id=activation.pk,
            capability__code__in=durationless_codes,
            ends_at__lte=models.F('starts_at'),
        ).update(ends_at=repaired_ends_at)


class Migration(migrations.Migration):
    dependencies = [('services', '0009_activation_terminated_audit_event')]

    operations = [
        migrations.RunPython(
            repair_quantity_activation_windows,
            migrations.RunPython.noop,
        ),
    ]
