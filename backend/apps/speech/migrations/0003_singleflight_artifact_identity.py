import hashlib

from django.db import migrations, models


def invalidate_legacy_artifacts(apps, _schema_editor):
    asset_model = apps.get_model('speech', 'BlogSpeechAsset')
    config_hash = hashlib.sha256(b'legacy-speech-artifact-v1').hexdigest()
    for asset in asset_model.objects.all().iterator():
        identity = (
            f'legacy\0{asset.pk}\0{asset.post_id}\0{asset.post_revision}\0'
            f'{asset.model_revision}\0{asset.voice_id}\0{asset.style}'
        )
        asset.artifact_key = hashlib.sha256(identity.encode()).hexdigest()
        asset.config_hash = config_hash
        asset.status = 'failed'
        asset.error_code = 'legacy_artifact_invalidated'
        asset.save(
            update_fields=[
                'artifact_key',
                'config_hash',
                'status',
                'error_code',
            ]
        )


class Migration(migrations.Migration):
    dependencies = [('speech', '0002_blogspeechasset_storage_key')]

    operations = [
        migrations.RenameField(
            model_name='blogspeechasset',
            old_name='content_hash',
            new_name='text_hash',
        ),
        migrations.AddField(
            model_name='blogspeechasset',
            name='artifact_key',
            field=models.CharField(db_index=True, default='', max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='blogspeechasset',
            name='config_hash',
            field=models.CharField(default='', max_length=64),
            preserve_default=False,
        ),
        migrations.RemoveConstraint(
            model_name='blogspeechasset',
            name='uq_speech_post_rev_voice',
        ),
        migrations.RunPython(invalidate_legacy_artifacts, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='blogspeechasset',
            name='asset_url',
        ),
        migrations.AlterField(
            model_name='blogspeechasset',
            name='status',
            field=models.CharField(
                choices=[
                    ('generating', 'Đang tạo'),
                    ('ready', 'Sẵn sàng'),
                    ('failed', 'Thất bại'),
                ],
                default='generating',
                max_length=16,
            ),
        ),
        migrations.AddConstraint(
            model_name='blogspeechasset',
            constraint=models.UniqueConstraint(
                fields=('post', 'artifact_key'),
                name='uq_speech_post_artifact',
            ),
        ),
    ]
