"""Fold the retired `considering` status into `viewed`.

`considering` and `viewed` both meant "the recruiter opened the CV but has not
answered yet" (both were in ``UNANSWERED_STATUSES``), so the history keeps its
meaning. Rows that become a no-op ``viewed → viewed`` change are deleted.

Irreversible on purpose: once collapsed, nothing records which `viewed` rows
used to be `considering`. Runs in its own migration (and transaction) so the
following schema migration can swap the check constraint without pending
trigger events.
"""

from django.db import migrations
from django.db.models import F
from django.db.models.functions import Coalesce

RETIRED = 'considering'
TARGET = 'viewed'


def collapse_considering(apps, schema_editor):
    Application = apps.get_model('applications', 'Application')
    History = apps.get_model('applications', 'ApplicationStatusHistory')
    CampaignActivity = apps.get_model('employers', 'CampaignActivity')

    Application.objects.filter(status=RETIRED).update(
        status=TARGET,
        viewed_at=Coalesce('viewed_at', 'status_updated_at'),
    )
    History.objects.filter(to_status=RETIRED).update(to_status=TARGET)
    History.objects.filter(from_status=RETIRED).update(from_status=TARGET)
    History.objects.filter(from_status=F('to_status')).delete()

    activities = CampaignActivity.objects.filter(
        event_type='application_status_changed',
    ).filter(metadata__from_status=RETIRED) | CampaignActivity.objects.filter(
        event_type='application_status_changed',
        metadata__to_status=RETIRED,
    )
    for activity in activities.iterator(chunk_size=200):
        metadata = dict(activity.metadata)
        for key in ('from_status', 'to_status'):
            if metadata.get(key) == RETIRED:
                metadata[key] = TARGET
        if metadata.get('from_status') == metadata.get('to_status'):
            activity.delete()
        else:
            activity.metadata = metadata
            activity.save(update_fields=['metadata'])


class Migration(migrations.Migration):
    dependencies = [
        ('applications', '0012_application_auto_rejected_at_and_more'),
        ('employers', '0052_company_page_content'),
    ]

    operations = [
        migrations.RunPython(collapse_considering, migrations.RunPython.noop),
    ]
