"""Proof submitted for a company the recruiter has since left is history.

Leaving used to retire only unapproved documents, so an approved data
processing agreement or business licence of the old company still showed as
"Đã duyệt" after joining a new one — or the same one again — while the
verification case, reset to a draft by leaving, said nothing was approved.
"""

from django.db import migrations
from django.db.models import F, Q


def retire(apps, schema_editor):
    CompanyDocument = apps.get_model('employers', 'CompanyDocument')
    stale = CompanyDocument.objects.filter(is_current=True, update_request__isnull=True).filter(
        Q(verification_case__isnull=False)
        & (
            # The case was reset by leaving (no company) or now proves another one.
            Q(verification_case__company__isnull=True)
            | ~Q(company_id=F('verification_case__company_id'))
            | Q(verification_case__recruiter__company__isnull=True)
            | ~Q(company_id=F('verification_case__recruiter__company_id'))
        )
        | Q(verification_case__isnull=True, recruiter__isnull=False)
        & (Q(recruiter__company__isnull=True) | ~Q(company_id=F('recruiter__company_id')))
    )
    stale.update(is_current=False)


class Migration(migrations.Migration):
    dependencies = [('employers', '0063_sync_verified_phone_formats')]

    operations = [migrations.RunPython(retire, migrations.RunPython.noop)]
