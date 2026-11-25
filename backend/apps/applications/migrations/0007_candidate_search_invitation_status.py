import uuid

from django.db import migrations, models


def fill_public_ids(apps, schema_editor):
    invitation_model = apps.get_model('applications', 'CandidateSearchInvitation')
    for invitation in invitation_model.objects.filter(public_id__isnull=True).only('pk'):
        invitation.public_id = f'csi_{uuid.uuid4().hex[:12]}'
        invitation.save(update_fields=['public_id'])


class Migration(migrations.Migration):
    dependencies = [
        ('applications', '0006_candidate_search'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidatesearchinvitation',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, null=True),
        ),
        migrations.RunPython(fill_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='candidatesearchinvitation',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
        migrations.AddField(
            model_name='candidatesearchinvitation',
            name='responded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='candidatesearchinvitation',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')],
                default='pending',
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name='candidatesearchinvitation',
            index=models.Index(fields=['candidate', '-invited_at'], name='search_invite_candidate_idx'),
        ),
    ]
