# ADR-0015: drops every service table. Irreversible in practice: unapplying it
# recreates empty tables only. Back up the database before running it.
#
# Dependents are deleted before the tables they reference, so the reverse
# direction (used by migration tests) recreates parents first.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('services', '0011_job_refresh_ranking_index'),
    ]

    operations = [
        migrations.DeleteModel(name='ConsultationLead'),
        migrations.DeleteModel(name='JobPromotionMetricDaily'),
        migrations.DeleteModel(name='SavedJobRemarketingImpression'),
        migrations.DeleteModel(name='ServiceAuditEvent'),
        migrations.DeleteModel(name='JobServiceAlertRecipient'),
        migrations.DeleteModel(name='JobServiceAlertDispatch'),
        migrations.DeleteModel(name='JobServiceUsageEvent'),
        migrations.DeleteModel(name='JobServiceActivationItem'),
        migrations.DeleteModel(name='JobServiceActivation'),
        migrations.DeleteModel(name='ServiceEntitlementUnit'),
        migrations.DeleteModel(name='ServicePackageVersionItem'),
        migrations.DeleteModel(name='ServicePackageVersion'),
        migrations.DeleteModel(name='ServiceCapability'),
        migrations.DeleteModel(name='ServicePackage'),
        migrations.DeleteModel(name='ServiceCategory'),
    ]
