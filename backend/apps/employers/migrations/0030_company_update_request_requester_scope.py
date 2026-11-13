import django.utils.timezone
from django.db import migrations, models
from django.db.models import F


def backfill_submitted_at(apps, schema_editor):
    update_request_model = apps.get_model('employers', 'CompanyUpdateRequest')
    update_request_model.objects.filter(submitted_at__isnull=True).update(
        submitted_at=F('created_at')
    )


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0029_campaign_policy_hold'),
    ]

    operations = [
        migrations.AddField(
            model_name='companyupdaterequest',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_submitted_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='companyupdaterequest',
            name='submitted_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.RemoveConstraint(
            model_name='companyupdaterequest',
            name='uniq_company_pending_update_request',
        ),
        migrations.AddConstraint(
            model_name='companyupdaterequest',
            constraint=models.UniqueConstraint(
                condition=models.Q(status='pending'),
                fields=('company', 'requested_by'),
                name='uniq_co_requester_pending_upd',
            ),
        ),
    ]
