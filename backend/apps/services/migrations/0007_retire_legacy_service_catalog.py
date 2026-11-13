from django.db import migrations


LEGACY_PACKAGE_SLUGS = (
    'top-max',
    'top-max-plus',
    'top-eco-plus',
    'combo-starter',
    'combo-growth',
    'ai-cv-screening',
    'ai-matching-credits',
    'branding-banner',
    'branding-top-employer',
    'job-refresh',
    'urgent-tag',
)
LEGACY_CATEGORY_KEYS = ('featured-jobs', 'combo', 'ai-credits', 'branding', 'addons')


def retire_legacy_catalog(apps, schema_editor):
    package_model = apps.get_model('services', 'ServicePackage')
    category_model = apps.get_model('services', 'ServiceCategory')

    for package in package_model.objects.filter(slug__in=LEGACY_PACKAGE_SLUGS):
        if package.versions.exists():
            package_model.objects.filter(pk=package.pk).update(is_active=False)
        else:
            package.delete()

    category_model.objects.filter(
        key__in=LEGACY_CATEGORY_KEYS,
        packages__isnull=True,
    ).delete()
    category_model.objects.filter(
        key__in=LEGACY_CATEGORY_KEYS,
        packages__isnull=False,
    ).update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [('services', '0006_job_service_alert_outbox')]

    operations = [
        migrations.RunPython(retire_legacy_catalog, migrations.RunPython.noop),
    ]
