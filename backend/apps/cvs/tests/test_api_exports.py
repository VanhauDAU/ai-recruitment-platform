"""Owner PDF exports and private thumbnails, rendered from immutable versions only."""

from copy import deepcopy
from hashlib import sha256
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.urls import reverse
from django.utils import timezone

from apps.cv_templates.models import empty_content, empty_layout, empty_style
from apps.cv_templates.services import print_payload
from apps.cvs.models import CvAccessLog, CvExport, CvVersion, UserCv
from apps.cvs.tasks.exports import generate_cv_thumbnail, render_cv_export_job

from .api_case import CvApiTestCase


class CvExportApiTests(CvApiTestCase):
    def test_pdf_export_uses_a_selected_immutable_version_not_the_mutable_draft(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        saved_payload = {
            key: deepcopy(draft[key])
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        saved_payload['content_json']['personal_info']['full_name'] = 'Frozen Export Candidate'
        self.client.put(
            self.draft_url(cv), saved_payload, format='json', HTTP_IF_MATCH='"lock-version-0"'
        )
        saved = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(saved.status_code, 201, saved.data)

        mutable_payload = deepcopy(saved_payload)
        mutable_payload['content_json']['personal_info']['full_name'] = 'Draft Must Never Export'
        self.client.put(
            self.draft_url(cv), mutable_payload, format='json', HTTP_IF_MATCH='"lock-version-1"'
        )

        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            response = self.client.post(
                self.exports_url(cv),
                {'version_public_id': saved.data['public_id']},
                format='json',
                REMOTE_ADDR='203.0.113.10',
                HTTP_USER_AGENT='export-browser',
            )
        self.assertEqual(response.status_code, 201, response.data)
        export = CvExport.objects.get(public_id=response.data['public_id'])
        self.assertEqual(export.status, CvExport.Status.PENDING)
        self.assertEqual(export.version.public_id, saved.data['public_id'])
        self.assertEqual(
            export.version.content_json['personal_info']['full_name'], 'Frozen Export Candidate'
        )
        self.assertEqual(
            cv.draft.content_json['personal_info']['full_name'], 'Draft Must Never Export'
        )
        self.assertEqual(export.renderer_key, 'single_column_v1')
        self.assertEqual(export.renderer_version, '1')
        self.assertNotIn('content_json', export.render_config)
        self.assertNotIn('storage_key', response.data)
        self.assertIsNone(response.data['download_url'])

        printed = str(print_payload(export.version)['document'])
        self.assertIn('Frozen Export Candidate', printed)
        self.assertNotIn('Draft Must Never Export', printed)
        audit = CvAccessLog.objects.get(cv=cv, access_channel=CvAccessLog.AccessChannel.EXPORT)
        self.assertEqual(audit.version_id, export.version_id)
        self.assertEqual(audit.actor_user_id, self.candidate.id)
        self.assertEqual(len(audit.ip_hash), 64)
        self.assertNotIn('content_json', {field.name for field in CvAccessLog._meta.fields})

    def test_pdf_export_defaults_to_published_before_newer_latest_version(self):
        cv = self.create_cv()
        published = self.client.post(
            reverse('cv-publish', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(published.status_code, 201, published.data)
        saved = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertNotEqual(saved.data['public_id'], published.data['public_id'])

        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            response = self.client.post(self.exports_url(cv), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['version_public_id'], published.data['public_id'])

    def test_pdf_renderer_uses_the_pinned_two_column_contract_without_content_conversion(self):
        cv = self.create_cv()
        alternate_template, alternate_version = self.create_alternate_template()
        switched = self.client.put(
            reverse('cv-template-switch', kwargs={'public_id': cv.public_id}),
            {'template_public_id': alternate_template.public_id},
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(switched.status_code, 200, switched.data)
        draft = self.client.get(self.draft_url(cv)).data
        payload = {
            key: deepcopy(draft[key])
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['content_json']['sections'] = [
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': 'Mục tiêu nghề nghiệp',
                'enabled': True,
                'items': [{'item_id': 'summary_item_1', 'value': 'Xây dựng sản phẩm hữu ích.'}],
            }
        ]
        payload['layout_json']['regions'][0]['section_instance_ids'] = ['summary_1']
        updated = self.client.put(
            self.draft_url(cv),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        saved = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-2"',
        )
        version = CvVersion.objects.get(public_id=saved.data['public_id'])

        printed = print_payload(version)

        self.assertEqual(version.template_version_id, alternate_version.id)
        self.assertEqual(printed['renderer_key'], 'sidebar_right_v1')
        self.assertEqual(
            [
                (region['id'], region['width_percent'])
                for region in printed['document']['layout_json']['regions']
            ],
            [('main', 68), ('sidebar', 32)],
        )
        self.assertEqual(printed['document']['content_json'], cv.draft.content_json)

    def test_pdf_export_reuses_valid_artifact_and_download_url_is_owner_controlled(self):
        cv = self.create_cv()
        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            created = self.client.post(self.exports_url(cv), format='json')
        self.assertEqual(created.status_code, 201, created.data)
        export = CvExport.objects.get(public_id=created.data['public_id'])
        key = f'private-test/{export.public_id}.pdf'
        default_storage.save(key, ContentFile(b'%PDF-1.4 immutable artifact'))
        CvExport.objects.filter(pk=export.pk).update(
            status=CvExport.Status.COMPLETED,
            storage_key=key,
            file_size_bytes=27,
            checksum_sha256=sha256(b'%PDF-1.4 immutable artifact').hexdigest(),
            completed_at=timezone.now(),
        )
        export.refresh_from_db()

        reused = self.client.post(self.exports_url(cv), format='json')
        self.assertEqual(reused.status_code, 200, reused.data)
        self.assertEqual(reused.data['public_id'], export.public_id)
        self.assertEqual(CvExport.objects.filter(cv=cv).count(), 1)
        self.assertTrue(
            reused.data['download_url'].endswith(self.export_url(cv, export, 'download'))
        )
        self.assertNotIn(key, reused.data['download_url'])
        self.assertNotIn('storage_key', reused.data)

        download = self.client.get(self.export_url(cv, export, 'download'))
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download['Content-Type'], 'application/pdf')
        self.assertEqual(b''.join(download.streaming_content), b'%PDF-1.4 immutable artifact')

    def test_pdf_export_worker_marks_failure_and_retry_keeps_the_same_version(self):
        cv = self.create_cv()
        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            created = self.client.post(self.exports_url(cv), format='json')
        export = CvExport.objects.get(public_id=created.data['public_id'])
        version_id = export.version_id
        draft_before = deepcopy(cv.draft.content_json)

        with patch(
            'apps.cvs.tasks.exports.render_cv_version_pdf',
            side_effect=RuntimeError('renderer unavailable'),
        ):
            render_cv_export_job(export.pk)
        export.refresh_from_db()
        self.assertEqual(export.status, CvExport.Status.FAILED)
        self.assertEqual(export.last_error, 'render_failed')
        self.assertEqual(export.version_id, version_id)
        cv.refresh_from_db()
        self.assertEqual(cv.draft.content_json, draft_before)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)

        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            retry = self.client.post(self.export_url(cv, export, 'retry'), format='json')
        self.assertEqual(retry.status_code, 202, retry.data)
        export.refresh_from_db()
        self.assertEqual(export.status, CvExport.Status.PENDING)
        self.assertEqual(export.version_id, version_id)
        self.assertEqual(CvExport.objects.filter(cv=cv).count(), 1)

    def test_pdf_export_worker_stores_a_private_pdf_artifact_from_version_only(self):
        cv = self.create_cv()
        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            created = self.client.post(self.exports_url(cv), format='json')
        export = CvExport.objects.get(public_id=created.data['public_id'])
        with patch(
            'apps.cvs.tasks.exports.render_cv_version_pdf',
            return_value=b'%PDF-1.4 rendered version',
        ) as renderer:
            render_cv_export_job(export.pk)
        export.refresh_from_db()
        self.assertEqual(export.status, CvExport.Status.COMPLETED)
        self.assertTrue(
            export.storage_key.startswith(f'cvs/exports/{cv.public_id}/{export.version.public_id}/')
        )
        self.assertTrue(default_storage.exists(export.storage_key))
        self.assertEqual(renderer.call_args.args[0].pk, export.version_id)
        self.assertNotIn('draft', renderer.call_args.kwargs)

    def test_pdf_export_blocks_idor_and_foreign_version_selection(self):
        cv = self.create_cv()
        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            created = self.client.post(self.exports_url(cv), format='json')
        export = CvExport.objects.get(public_id=created.data['public_id'])

        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(self.exports_url(cv)).status_code, 404)
        self.assertEqual(self.client.post(self.exports_url(cv), format='json').status_code, 404)
        self.assertEqual(self.client.get(self.export_url(cv, export)).status_code, 404)
        self.assertEqual(self.client.get(self.export_url(cv, export, 'download')).status_code, 404)

        self.client.force_authenticate(self.candidate)
        other_cv = UserCv.objects.create(
            user=self.other_candidate,
            title='Other CV',
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            language='vi-VN',
        )
        other_version = CvVersion.objects.create(
            cv=other_cv,
            version_number=1,
            version_kind=CvVersion.VersionKind.INITIAL,
            template_version=self.template_version,
            schema_version=1,
            content_json=empty_content(),
            layout_json=empty_layout(),
            style_json=empty_style(),
            content_hash='a' * 64,
            created_by=self.other_candidate,
        )
        response = self.client.post(
            self.exports_url(cv),
            {'version_public_id': other_version.public_id},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(CvExport.objects.filter(cv=cv).count(), 1)

        employer = get_user_model().objects.create_user(
            email='export-employer@example.com',
            password='password',
            role='employer',
        )
        self.client.force_authenticate(employer)
        self.assertEqual(self.client.post(self.exports_url(cv), format='json').status_code, 403)

    @patch('apps.cvs.tasks.exports.first_pdf_page_image', return_value=b'webp-preview')
    @patch('apps.cvs.tasks.exports.render_cv_version_pdf', return_value=b'%PDF-1.4')
    def test_private_thumbnail_is_generated_from_latest_version_and_owner_scoped(
        self, _render, _raster
    ):
        cv = self.create_cv()
        cv.refresh_from_db()

        generate_cv_thumbnail(cv.latest_version_id)
        cv.refresh_from_db()

        self.assertTrue(cv.thumbnail_url.endswith('.webp'))
        response = self.client.get(reverse('cv-thumbnail', kwargs={'public_id': cv.public_id}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/webp')
        self.assertEqual(b''.join(response.streaming_content), b'webp-preview')

        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(
            self.client.get(
                reverse('cv-thumbnail', kwargs={'public_id': cv.public_id})
            ).status_code,
            404,
        )
