"""Uploaded/imported CV files and the avatar image: validation, import jobs, source reads."""

from io import BytesIO
from unittest.mock import patch
from zipfile import ZIP_DEFLATED, ZipFile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.cv_templates.models import empty_content
from apps.cvs.models import CvAccessLog, CvAsset, CvImportJob, CvVersion, UserCv
from apps.cvs.tasks.imports import ImportProcessingError, process_cv_import_job
from apps.cvs.tests.factories import CV_LINES, cv_pdf_upload, docx_bytes, pdf_bytes

from .api_case import CvApiTestCase


class CvUploadApiTests(CvApiTestCase):
    def source_file_url(self, cv):
        return reverse('cv-source-file', kwargs={'public_id': cv.public_id})

    def _docx_upload(self, name='source.docx'):
        content = docx_bytes(('Nguyen Van Candidate', *CV_LINES[1:]))
        return SimpleUploadedFile(
            name,
            content,
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

    def test_owner_views_uploaded_pdf_source_inline_and_others_cannot(self):
        cv = self.import_uploaded_cv(cv_pdf_upload('source.pdf'))

        owner_view = self.client.get(self.owner_view_url(cv))
        response = self.client.get(self.source_file_url(cv))

        self.assertEqual(owner_view.data['cv']['cv_type'], UserCv.CvType.UPLOADED)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response['Content-Disposition'].startswith('inline'))
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(b''.join(response.streaming_content), pdf_bytes())

        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(self.source_file_url(cv)).status_code, 404)

    def test_shared_link_of_uploaded_cv_serves_the_original_file_without_double_audit(self):
        cv = self.import_uploaded_cv(cv_pdf_upload('source.pdf'))
        created = self.client.post(
            self.shared_links_url(cv),
            {'version_public_id': cv.latest_version.public_id},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        token = created.data['token']
        self.client.force_authenticate(None)

        page = self.client.get(reverse('cv-shared-link-public', kwargs={'token': token}))
        logs_after_page = CvAccessLog.objects.filter(cv=cv).count()
        source = self.client.get(reverse('cv-shared-source-file', kwargs={'token': token}))
        missing = self.client.get(reverse('cv-shared-source-file', kwargs={'token': 'not-real'}))

        self.assertEqual(page.data['cv']['cv_type'], UserCv.CvType.UPLOADED)
        self.assertEqual(source.status_code, 200)
        self.assertEqual(b''.join(source.streaming_content), pdf_bytes())
        self.assertEqual(CvAccessLog.objects.filter(cv=cv).count(), logs_after_page)
        self.assertEqual(missing.status_code, 404)

    @patch('apps.cvs.services.cvs.render_office_document_preview', return_value=b'%PDF-docx')
    def test_uploaded_docx_source_is_converted_to_pdf(self, render_preview):
        cv = self.import_uploaded_cv(self._docx_upload())

        response = self.client.get(self.source_file_url(cv))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), b'%PDF-docx')
        render_preview.assert_called_once()
        self.assertEqual(render_preview.call_args.args[0], cv.file_url)

    @patch('apps.cvs.services.cvs.render_office_document_preview', return_value=None)
    def test_source_file_is_unavailable_for_builder_cvs_and_failed_conversions(self, _render):
        builder = self.create_cv()
        docx = self.import_uploaded_cv(self._docx_upload())

        self.assertEqual(self.client.get(self.source_file_url(builder)).status_code, 404)
        self.assertEqual(self.client.get(self.source_file_url(docx)).status_code, 404)

    def test_upload_that_is_not_a_cv_is_rejected_without_creating_one(self):
        response = self.client.post(
            reverse('cv-import'),
            {'file': cv_pdf_upload('invoice.pdf', ('Hoa don ban hang so 123, tong 500.000 VND',))},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'CV_REJECTED')
        self.assertEqual(response.data['reason'], 'not_a_cv')
        self.assertFalse(UserCv.objects.filter(user=self.candidate).exists())

    def test_import_hard_delete_and_metadata_use_v2_without_legacy_storage_urls(self):
        uploaded = cv_pdf_upload('source.pdf')
        imported = self.client.post(
            reverse('cv-import'),
            {'file': uploaded, 'title': 'Imported CV'},
            format='multipart',
        )

        self.assertEqual(imported.status_code, 201, imported.data)
        self.assertEqual(imported.data['source'], UserCv.Source.IMPORTED)
        self.assertEqual(imported.data['cv_type'], UserCv.CvType.UPLOADED)
        self.assertEqual(imported.data['file_name'], 'source.pdf')
        self.assertNotIn('file_url', imported.data)
        cv = UserCv.objects.get(public_id=imported.data['public_id'])
        self.assertEqual(cv.latest_version.version_kind, CvVersion.VersionKind.IMPORTED)
        # Response phải mang sẵn con trỏ version: form ứng tuyển gửi thẳng version_public_id lấy
        # từ đây, thiếu là API application trả "Phiên bản CV: vui lòng nhập thông tin bắt buộc".
        self.assertEqual(imported.data['latest_version_public_id'], cv.latest_version.public_id)

        metadata = self.client.patch(
            reverse('cv-detail', kwargs={'public_id': cv.public_id}),
            {'title': 'Renamed CV', 'is_default': True},
            format='json',
        )
        self.assertEqual(metadata.status_code, 200, metadata.data)
        self.assertEqual(metadata.data['title'], 'Renamed CV')
        self.assertTrue(metadata.data['is_default'])

        deleted = self.client.delete(reverse('cv-detail', kwargs={'public_id': cv.public_id}))
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(UserCv.objects.filter(pk=cv.pk).exists())
        self.assertFalse(CvVersion.objects.filter(cv_id=cv.pk).exists())
        self.assertEqual(
            self.client.get(reverse('cv-detail', kwargs={'public_id': cv.public_id})).status_code,
            404,
        )

    @patch('apps.cvs.tasks.imports.structure_cv_text')
    def test_template_import_is_idempotent_and_materializes_editable_canonical_draft(
        self, structure_cv_text
    ):
        payload = {
            'file': self._docx_upload(),
            'title': 'Parsed CV',
            'template_public_id': self.template.public_id,
            'language': 'vi-VN',
            'theme_color': '#2255AA',
        }
        with patch('apps.cvs.tasks.imports.process_cv_import_job.delay'):
            first = self.client.post(
                reverse('cv-import'),
                payload,
                format='multipart',
                HTTP_IDEMPOTENCY_KEY='same-import',
            )
            second = self.client.post(
                reverse('cv-import'),
                {**payload, 'file': self._docx_upload()},
                format='multipart',
                HTTP_IDEMPOTENCY_KEY='same-import',
            )

        self.assertEqual(first.status_code, 202, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data['public_id'], second.data['public_id'])
        self.assertEqual(CvImportJob.objects.count(), 1)

        cv = UserCv.objects.get(public_id=first.data['public_id'])
        parsed_content = empty_content('vi-VN')
        parsed_content['personal_info']['full_name'] = 'Nguyen Van Candidate'
        structure_cv_text.return_value = parsed_content
        process_cv_import_job(cv.import_job.pk)
        cv.refresh_from_db()
        cv.import_job.refresh_from_db()
        self.assertEqual(cv.processing_status, UserCv.ProcessingStatus.ANALYZED)
        self.assertEqual(cv.import_job.status, CvImportJob.Status.COMPLETED)
        self.assertEqual(cv.latest_version.version_kind, CvVersion.VersionKind.IMPORTED)
        self.assertEqual(
            cv.draft.content_json['personal_info']['full_name'], 'Nguyen Van Candidate'
        )
        self.assertEqual(cv.draft.style_json['theme_color'], '#2255AA')

    def test_import_rejects_spoofed_file_signature_before_persisting(self):
        upload = SimpleUploadedFile(
            'spoofed.pdf', b'not a real pdf', content_type='application/pdf'
        )
        response = self.client.post(
            reverse('cv-import'),
            {'file': upload, 'template_public_id': self.template.public_id, 'language': 'vi-VN'},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(CvImportJob.objects.count(), 0)

    def test_import_rejects_a_pdf_header_hidden_behind_another_format(self):
        # Only whitespace or a BOM may precede the header; anything else is a polyglot.
        upload = SimpleUploadedFile(
            'smuggled.pdf', b'GIF89a' + pdf_bytes(), content_type='application/pdf'
        )

        response = self.client.post(reverse('cv-import'), {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(UserCv.objects.filter(user=self.candidate).exists())

    def test_import_rejects_a_zip_bomb_docx_before_python_docx_opens_it(self):
        bomb = BytesIO()
        with ZipFile(bomb, 'w', compression=ZIP_DEFLATED) as archive:
            archive.writestr('[Content_Types].xml', b'<Types/>')
            # ~4 MB XML nén còn vài KB: tỉ lệ vượt 100 lần.
            archive.writestr('word/document.xml', b'<w:t>' + b'0' * (4 * 1024 * 1024))
        upload = SimpleUploadedFile(
            'bomb.docx',
            bomb.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        with patch('docx.Document') as python_docx:
            response = self.client.post(reverse('cv-import'), {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, 400)
        python_docx.assert_not_called()
        self.assertFalse(UserCv.objects.filter(user=self.candidate).exists())

    def test_import_accepts_a_pdf_header_after_a_valid_leading_preamble(self):
        upload = SimpleUploadedFile(
            'generated-cv.pdf',
            b'\xef\xbb\xbf\n' + pdf_bytes(),
            content_type='application/pdf',
        )

        response = self.client.post(
            reverse('cv-import'),
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['file_name'], 'generated-cv.pdf')

    def test_failed_import_exposes_safe_code_and_can_retry(self):
        with patch('apps.cvs.tasks.imports.process_cv_import_job.delay'):
            queued = self.client.post(
                reverse('cv-import'),
                {
                    'file': self._docx_upload(),
                    'template_public_id': self.template.public_id,
                    'language': 'vi-VN',
                },
                format='multipart',
            )
        cv = UserCv.objects.get(public_id=queued.data['public_id'])
        with patch(
            'apps.cvs.tasks.imports._extract_import_text',
            side_effect=ImportProcessingError('scanned_pdf_ocr_unavailable'),
        ):
            process_cv_import_job(cv.import_job.pk)

        cv.refresh_from_db()
        cv.import_job.refresh_from_db()
        self.assertEqual(cv.processing_status, UserCv.ProcessingStatus.FAILED)
        self.assertEqual(cv.import_job.failure_code, 'scanned_pdf_ocr_unavailable')
        self.assertNotIn('Nguyen Van Candidate', cv.error_message)

        with patch('apps.cvs.tasks.imports.process_cv_import_job.delay') as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                retried = self.client.post(
                    reverse('cv-import-retry', kwargs={'public_id': cv.public_id}),
                    {},
                    format='json',
                )
        self.assertEqual(retried.status_code, 202, retried.data)
        cv.import_job.refresh_from_db()
        self.assertEqual(cv.import_job.status, CvImportJob.Status.QUEUED)
        enqueue.assert_called_once_with(cv.import_job.pk)

    def test_avatar_upload_reencodes_image_and_enforces_owner_access(self):
        buffer = BytesIO()
        Image.new('RGB', (900, 700), '#2255AA').save(buffer, format='JPEG')
        upload = SimpleUploadedFile('avatar.jpg', buffer.getvalue(), content_type='image/jpeg')

        created = self.client.post(reverse('cv-asset-upload'), {'file': upload}, format='multipart')

        self.assertEqual(created.status_code, 201, created.data)
        self.assertNotIn('storage_key', created.data)
        self.assertLessEqual(created.data['width'], 512)
        self.assertLessEqual(created.data['height'], 512)
        self.assertIn('?token=', created.data['url'])
        asset = CvAsset.objects.get(public_id=created.data['public_id'])
        content_url = reverse('cv-asset-content', kwargs={'asset_public_id': asset.public_id})
        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(content_url).status_code, 404)
        self.assertEqual(self.client.get(created.data['url']).status_code, 200)
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get(content_url).status_code, 200)

        invalid = SimpleUploadedFile('avatar.png', b'not-an-image', content_type='image/png')
        rejected = self.client.post(
            reverse('cv-asset-upload'), {'file': invalid}, format='multipart'
        )
        self.assertEqual(rejected.status_code, 400)
