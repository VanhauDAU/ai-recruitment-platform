"""Backfill: create an immutable snapshot for every legacy application.

Runs after the columns exist (0004) and before the FK is made mandatory (0006).
This migration only touches data, never schema, so it commits cleanly on its own
and flushes the deferred FK trigger events before the contract migration runs.

Idempotent by design: it skips applications that already carry a snapshot and
reuses the deterministic ``cvv-application-{pk}`` version if a previous run (or a
previously-applied monolithic migration) already created it. Re-running the
migration therefore never raises a duplicate ``public_id`` error.
"""

from hashlib import sha256
import json

from django.db import migrations


def backfill_application_snapshots(apps, schema_editor):
    Application = apps.get_model('applications', 'Application')
    CvVersion = apps.get_model('cvs', 'CvVersion')
    UserCv = apps.get_model('cvs', 'UserCv')

    backfilled = 0
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

        # Reuse the deterministic snapshot if a prior run already created it,
        # so the migration is safe to re-apply (expand/contract retries, or a
        # database that previously ran the monolithic migration). Reusing blindly
        # would be unsafe, so verify the existing row genuinely belongs to this
        # application's CV and is a snapshot before linking to it — otherwise a
        # corrupt/partial state would silently mislink the recruiter's view.
        snapshot_public_id = f'cvv-application-{application.pk}'
        snapshot = CvVersion.objects.filter(public_id=snapshot_public_id).first()
        if snapshot is not None and (snapshot.cv_id != cv.pk or snapshot.version_kind != 'application_snapshot'):
            raise RuntimeError(
                f'Refusing to reuse snapshot {snapshot_public_id!r} for application '
                f'{application.pk}: expected cv_id={cv.pk} and '
                f"version_kind='application_snapshot', found cv_id={snapshot.cv_id} "
                f'and version_kind={snapshot.version_kind!r}. Investigate the data '
                f'inconsistency (see: manage.py cv_snapshot_preflight).'
            )
        if snapshot is None:
            next_number = (CvVersion.objects.filter(cv_id=cv.pk).order_by('-version_number').values_list('version_number', flat=True).first() or 0) + 1
            snapshot = CvVersion.objects.create(
                public_id=snapshot_public_id,
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
        backfilled += 1

    if backfilled:
        print(f'    backfilled {backfilled} application snapshot(s)')


class Migration(migrations.Migration):
    # Data-only migration. atomic=False keeps each large-table backfill from
    # holding one giant transaction and, critically, commits the writes before
    # the contract migration alters the table.
    atomic = False

    dependencies = [
        ('applications', '0004_application_snapshot_expand'),
    ]

    operations = [
        migrations.RunPython(backfill_application_snapshots, migrations.RunPython.noop),
    ]
