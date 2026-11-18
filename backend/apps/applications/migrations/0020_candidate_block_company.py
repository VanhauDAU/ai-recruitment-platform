"""Move candidate blocks from the recruiter to the company they belonged to.

Each existing block takes the blocker's current company, or the company of the
job it was made from. A block with neither cannot cover any job and is lifted.
When two colleagues blocked the same candidate, the oldest block is kept.
"""

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone


def assign_company(apps, schema_editor):
    CandidateBlock = apps.get_model('applications', 'CandidateBlock')
    RecruiterProfile = apps.get_model('employers', 'RecruiterProfile')
    company_by_user = dict(
        RecruiterProfile.objects.filter(company_id__isnull=False).values_list(
            'user_id', 'company_id'
        )
    )
    now = timezone.now()
    kept = set()
    for block in CandidateBlock.objects.select_related('source_application__job').order_by(
        'created_at', 'id'
    ):
        company_id = company_by_user.get(block.recruiter_id)
        if company_id is None and block.source_application_id:
            company_id = block.source_application.job.company_id
        if company_id is None:
            block.delete()
            continue
        block.company_id = company_id
        if block.lifted_at is None:
            key = (company_id, block.candidate_id)
            if key in kept:
                block.lifted_at = now
            else:
                kept.add(key)
        block.save(update_fields=['company', 'lifted_at'])


class Migration(migrations.Migration):
    dependencies = [
        ('applications', '0019_application_reminder'),
        ('employers', '0059_application_awaiting_reply_event'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='candidateblock',
            name='uniq_active_candidate_block',
        ),
        migrations.AddField(
            model_name='candidateblock',
            name='company',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='candidate_blocks',
                to='employers.company',
            ),
        ),
        migrations.RunPython(assign_company, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='candidateblock',
            name='company',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='candidate_blocks',
                to='employers.company',
            ),
        ),
        migrations.AddConstraint(
            model_name='candidateblock',
            constraint=models.UniqueConstraint(
                condition=Q(lifted_at__isnull=True),
                fields=('company', 'candidate'),
                name='uniq_active_company_candidate_block',
            ),
        ),
    ]
