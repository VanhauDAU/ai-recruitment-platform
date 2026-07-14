"""Expand, backfill, then contract the immutable application snapshot FK."""

from hashlib import sha256
import json

from django.db import migrations, models
import django.db.models.deletion


def backfill_application_snapshots(apps, schema_editor):
    Application = apps.get_model('applications', 'Application')
    CvVersion = apps.get_model('cvs', 'CvVersion')
    UserCv = apps.get_model('cvs', 'UserCv')
    for application in Application.objects.filter(submitted_cv_version__isnull=True).iterator():
        cv = UserCv.objects.get(pk=application.cv_id)
        base = CvVersion.objects.filter(cv_id=cv.pk).order_by('-version_number').first()
        if base is None:
            # Defensive fallback for a manually altered legacy database. Normal
            # installations already have a V1 baseline from cvs.0002.
            content = {
                'schema_version': 1, 'locale': 'vi-VN',
                'personal_info': {'full_name': '', 'headline': '', 'email': '', 'phone': '', 'address': '', 'avatar_asset_id': None, 'links': []},
                'sections': [], 'custom_fields': {},
            }
            layout = {'schema_version': 1, 'page': {'size': 'A4', 'margin_mm': 12}, 'regions': [{'id': 'main', 'width_percent': 100, 'section_instance_ids': []}]}
            style = {'schema_version': 1, 'theme_color': '#00A66A', 'font_family': 'Roboto', 'font_scale': 1.0, 'line_height': 1.4, 'background_asset_id': None, 'section_overrides': {}}
            digest = sha256(json.dumps({'content': content, 'layout': layout, 'style': style}, sort_keys=True).encode('utf-8')).hexdigest()
            base = CvVersion.objects.create(
                public_id=f'cvv-recovery-{cv.pk}-1', cv_id=cv.pk, version_number=1,
                version_kind='initial' if cv.cv_type == 'builder' else 'imported',
                schema_version=1, content_json=content, layout_json=layout, style_json=style,
                plain_text=cv.normalized_text or cv.raw_text or '', content_hash=digest, created_by_id=cv.user_id,
            )
        next_number = (CvVersion.objects.filter(cv_id=cv.pk).order_by('-version_number').values_list('version_number', flat=True).first() or 0) + 1
        snapshot = CvVersion.objects.create(
            public_id=f'cvv-application-{application.pk}',
            cv_id=cv.pk,
            version_number=next_number,
            version_kind='application_snapshot',
            template_version_id=base.template_version_id,
            parent_version_id=base.pk,
            schema_version=base.schema_version,
            content_json=base.content_json,
            layout_json=base.layout_json,
            style_json=base.style_json,
            plain_text=base.plain_text,
            content_hash=base.content_hash,
            created_by_id=application.candidate_id,
        )
        Application.objects.filter(pk=application.pk).update(
            submitted_cv_version_id=snapshot.pk,
            submitted_cv_title=cv.title,
            submitted_cv_source=cv.source,
            submitted_at=application.applied_at,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0003_initial'),
        ('cvs', '0002_architecture_foundation'),
    ]

    operations = [
        # Expand: nullable FK allows the deployment containing this migration to
        # run safely before every legacy application has been backfilled.
        migrations.AddField(
            model_name='application',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='application',
            name='submitted_cv_source',
            field=models.CharField(default='builder', max_length=30),
        ),
        migrations.AddField(
            model_name='application',
            name='submitted_cv_title',
            field=models.CharField(default='', max_length=255),
        ),
        migrations.AddField(
            model_name='application',
            name='submitted_cv_version',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='submitted_applications', to='cvs.cvversion'),
        ),
        migrations.RunPython(backfill_application_snapshots, migrations.RunPython.noop),
        # Contract: every historical and new application now has a durable
        # snapshot. This is intentionally separate from the additive fields.
        migrations.AlterField(
            model_name='application',
            name='submitted_cv_version',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='submitted_applications', to='cvs.cvversion'),
        ),
        migrations.AddIndex(
            model_name='application',
            index=models.Index(fields=['submitted_cv_version'], name='idx_app_submitted_cv_version'),
        ),
    ]
