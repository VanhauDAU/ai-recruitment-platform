"""Expand and backfill canonical CV versions and drafts.

No legacy field is removed here.  This is the Expand + Backfill portion of the
rollout; API cutover and eventual legacy-column removal happen in later
releases after dual-read verification.
"""

from hashlib import sha256
import json

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def canonical_documents(cv):
    content = {
        'schema_version': 1,
        'locale': 'vi-VN',
        'personal_info': {
            'full_name': '', 'headline': '', 'email': '', 'phone': '',
            'address': '', 'avatar_asset_id': None, 'links': [],
        },
        'sections': [],
        'custom_fields': {},
    }
    legacy = cv.cv_data if isinstance(cv.cv_data, dict) else {}
    personal = legacy.get('personal_info', legacy.get('personal', {}))
    if isinstance(personal, dict):
        for key in content['personal_info']:
            if key in personal:
                content['personal_info'][key] = personal[key]
    for section_key in ('summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'awards'):
        legacy_items = legacy.get(section_key)
        if not legacy_items:
            continue
        items = legacy_items if isinstance(legacy_items, list) else [legacy_items]
        content['sections'].append({
            'instance_id': f'legacy_{section_key}_1',
            'section_key': section_key,
            'title': section_key.replace('_', ' ').title(),
            'enabled': True,
            'items': [
                dict(item, item_id=item.get('item_id', f'legacy_{section_key}_{index + 1}'))
                if isinstance(item, dict) else {'item_id': f'legacy_{section_key}_{index + 1}', 'value': str(item)}
                for index, item in enumerate(items)
            ],
        })
    layout = {
        'schema_version': 1,
        'page': {'size': 'A4', 'margin_mm': 12},
        'regions': [{'id': 'main', 'width_percent': 100, 'section_instance_ids': [
            section['instance_id'] for section in content['sections']
        ]}],
    }
    style = {
        'schema_version': 1,
        'theme_color': '#00A66A',
        'font_family': 'Roboto',
        'font_scale': 1.0,
        'line_height': 1.4,
        'background_asset_id': None,
        'section_overrides': {},
    }
    legacy_style = cv.style_config if isinstance(cv.style_config, dict) else {}
    color = legacy_style.get('theme_color', legacy_style.get('color'))
    if isinstance(color, str) and len(color) == 7 and color.startswith('#'):
        style['theme_color'] = color
    if legacy_style.get('font_family') in {'Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'}:
        style['font_family'] = legacy_style['font_family']
    return content, layout, style


def document_hash(content, layout, style):
    payload = json.dumps({'content': content, 'layout': layout, 'style': style}, sort_keys=True, separators=(',', ':'))
    return sha256(payload.encode('utf-8')).hexdigest()


def backfill_cv_foundation(apps, schema_editor):
    UserCv = apps.get_model('cvs', 'UserCv')
    CvVersion = apps.get_model('cvs', 'CvVersion')
    CvDraft = apps.get_model('cvs', 'CvDraft')
    for cv in UserCv.objects.all().iterator():
        content, layout, style = canonical_documents(cv)
        version, _ = CvVersion.objects.get_or_create(
            cv_id=cv.pk,
            version_number=1,
            defaults={
                'public_id': f'cvv-migrated-{cv.pk}-1',
                'version_kind': 'initial' if cv.cv_type == 'builder' else 'imported',
                'template_version_id': cv.template.current_published_version_id if cv.template_id else None,
                'schema_version': 1,
                'content_json': content,
                'layout_json': layout,
                'style_json': style,
                'plain_text': cv.normalized_text or cv.raw_text or '',
                'content_hash': document_hash(content, layout, style),
                'created_by_id': cv.user_id,
            },
        )
        processing_status = {
            'processing': 'processing', 'analyzed': 'analyzed', 'failed': 'failed',
        }.get(cv.status, 'idle')
        UserCv.objects.filter(pk=cv.pk).update(
            lifecycle_status='archived' if cv.is_deleted else 'draft',
            processing_status=processing_status,
            latest_version_id=version.pk,
            current_template_version_id=version.template_version_id,
            current_version=version.version_number,
        )
        if cv.cv_type == 'builder':
            CvDraft.objects.get_or_create(
                cv_id=cv.pk,
                defaults={
                    'base_version_id': version.pk,
                    'content_json': content,
                    'layout_json': layout,
                    'style_json': style,
                    'schema_version': 1,
                    'lock_version': 0,
                    'updated_by_id': cv.user_id,
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ('cv_templates', '0002_architecture_foundation'),
        ('cvs', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(model_name='usercv', name='archived_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='usercv', name='language', field=models.CharField(default='vi-VN', max_length=16)),
        migrations.AddField(model_name='usercv', name='lifecycle_status', field=models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft', max_length=20)),
        migrations.AddField(model_name='usercv', name='lock_version', field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name='usercv', name='processing_status', field=models.CharField(choices=[('idle', 'Idle'), ('queued', 'Queued'), ('processing', 'Processing'), ('analyzed', 'Analyzed'), ('failed', 'Failed')], default='idle', max_length=20)),
        migrations.AddField(model_name='usercv', name='published_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='usercv', name='visibility', field=models.CharField(choices=[('private', 'Private'), ('application_only', 'Application only'), ('shared_link', 'Shared link')], default='private', max_length=30)),
        migrations.AddField(model_name='usercv', name='current_template_version', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='current_cvs', to='cv_templates.cvtemplateversion')),
        migrations.CreateModel(
            name='CvVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('version_number', models.PositiveIntegerField()),
                ('version_kind', models.CharField(choices=[('initial', 'Initial'), ('manual_save', 'Manual save'), ('published', 'Published'), ('application_snapshot', 'Application snapshot'), ('export_snapshot', 'Export snapshot'), ('imported', 'Imported')], default='manual_save', max_length=30)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('content_json', models.JSONField(default=dict)),
                ('layout_json', models.JSONField(default=dict)),
                ('style_json', models.JSONField(default=dict)),
                ('plain_text', models.TextField(blank=True)),
                ('content_hash', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_cv_versions', to=settings.AUTH_USER_MODEL)),
                ('cv', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='versions', to='cvs.usercv')),
                ('parent_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='child_versions', to='cvs.cvversion')),
                ('template_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='cv_versions', to='cv_templates.cvtemplateversion')),
            ],
            options={'ordering': ['cv_id', '-version_number']},
        ),
        migrations.CreateModel(
            name='CvDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content_json', models.JSONField(default=dict)),
                ('layout_json', models.JSONField(default=dict)),
                ('style_json', models.JSONField(default=dict)),
                ('schema_version', models.PositiveIntegerField(default=1)),
                ('lock_version', models.PositiveIntegerField(default=0)),
                ('client_session_id', models.CharField(blank=True, max_length=100)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('base_version', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='drafts_based_on', to='cvs.cvversion')),
                ('cv', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='draft', to='cvs.usercv')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_cv_drafts', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(model_name='usercv', name='latest_version', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='cvs.cvversion')),
        migrations.AddField(model_name='usercv', name='published_version', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='cvs.cvversion')),
        migrations.AddConstraint(model_name='cvversion', constraint=models.UniqueConstraint(fields=('cv', 'version_number'), name='uq_cv_version_number')),
        migrations.AddConstraint(model_name='cvversion', constraint=models.CheckConstraint(condition=models.Q(('version_number__gt', 0)), name='chk_cv_version_number')),
        migrations.AddIndex(model_name='cvversion', index=models.Index(fields=['cv', '-version_number'], name='idx_cv_versions_cv_created')),
        migrations.AddIndex(model_name='cvversion', index=models.Index(fields=['content_hash'], name='idx_cv_versions_content_hash')),
        migrations.AddIndex(model_name='usercv', index=models.Index(fields=['user', 'lifecycle_status', '-updated_at'], name='idx_user_cvs_lifecycle')),
        migrations.RunPython(backfill_cv_foundation, migrations.RunPython.noop),
    ]
