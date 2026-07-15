from hashlib import sha256
import json

from django.db import migrations, models


def hash_existing_drafts(apps, schema_editor):
    CvDraft = apps.get_model('cvs', 'CvDraft')
    for draft in CvDraft.objects.all().iterator():
        payload = json.dumps(
            {
                'content': draft.content_json,
                'layout': draft.layout_json,
                'style': draft.style_json,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(',', ':'),
        )
        draft.document_hash = sha256(payload.encode('utf-8')).hexdigest()
        draft.save(update_fields=['document_hash'])


class Migration(migrations.Migration):

    dependencies = [
        ('cvs', '0006_usercv_position'),
    ]

    operations = [
        migrations.AddField(
            model_name='cvdraft',
            name='document_hash',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.RunPython(hash_existing_drafts, migrations.RunPython.noop),
    ]
