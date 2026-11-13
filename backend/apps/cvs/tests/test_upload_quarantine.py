from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.cv_templates.models import CvTemplate, CvTemplateVersion
from apps.sitecontent.models import Locale
from apps.uploads.models import UploadAsset, UploadState
from apps.uploads.services import (
    create_upload_session,
    process_upload_scan,
    store_quarantined_upload,
)
from apps.uploads.tests.fakes import FakeUploadScanner
from apps.uploads.tests.helpers import TemporaryUploadStorageMixin

from ..models import CvAsset, CvImportJob, UserCv
from ..schemas import empty_layout, empty_style
from ..services.upload_claims import CV_AVATAR_CLAIM_SCOPE, CV_SOURCE_CLAIM_SCOPE
from ..tasks import purge_expired_cv_import_sources


class CandidateCvUploadQuarantineTests(TemporaryUploadStorageMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.candidate = get_user_model().objects.create_user(
            email='candidate-upload-quarantine@example.com',
            password='Password@123',
            role='candidate',
            email_verified=True,
        )
        self.other_candidate = get_user_model().objects.create_user(
            email='candidate-upload-other@example.com',
            password='Password@123',
            role='candidate',
            email_verified=True,
        )
        self.client.force_authenticate(self.candidate)

    def create_clean_session(self, upload):
        session = create_upload_session(
            owner=self.candidate,
            purpose='candidate_cv',
            original_filename=upload.name,
            content_type=upload.content_type,
            expected_size_bytes=upload.size,
        )
        store_quarantined_upload(
            owner=self.candidate,
            public_id=session.public_id,
            upload=upload,
        )
        outcome = process_upload_scan(session.pk, scanner=FakeUploadScanner())
        self.assertEqual(outcome.state, UploadState.CLEAN)
        return session

    def test_import_claims_clean_source_before_creating_owner_cv(self):
        upload = SimpleUploadedFile(
            'candidate.pdf', b'%PDF-1.7\ncandidate', content_type='application/pdf'
        )
        session = self.create_clean_session(upload)

        response = self.client.post(
            reverse('cv-v2-import'),
            {'upload_session': session.public_id, 'title': 'CV an toàn'},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        cv = UserCv.objects.get(public_id=response.data['public_id'])
        source = UploadAsset.objects.get(source_session=session)
        self.assertEqual(source.claim_scope, CV_SOURCE_CLAIM_SCOPE)
        self.assertEqual(source.claim_reference, cv.public_id)
        self.assertEqual(cv.file_url, source.storage_key)
        self.assertEqual(cv.file_name, 'candidate.pdf')

    def test_template_import_claims_once_and_keeps_idempotency(self):
        Locale.objects.update_or_create(
            code='vi-VN',
            defaults={
                'label_vi': 'Tiếng Việt',
                'label_en': 'Vietnamese',
                'is_active': True,
                'is_default': True,
            },
        )
        template = CvTemplate.objects.create(
            name='Quarantine template',
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        )
        version = CvTemplateVersion.objects.create(
            template=template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='classic_single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
            content_contract={'schema': 'canonical_cv_content_v1', 'schema_version': 1},
        )
        template.current_published_version = version
        template.save(update_fields=['current_published_version'])
        session = self.create_clean_session(
            SimpleUploadedFile(
                'template-source.pdf',
                b'%PDF-1.7\ntemplate source',
                content_type='application/pdf',
            )
        )
        payload = {
            'upload_session': session.public_id,
            'template_public_id': template.public_id,
            'language': 'vi-VN',
        }

        with self.captureOnCommitCallbacks(execute=False):
            first = self.client.post(
                reverse('cv-v2-import'),
                payload,
                format='multipart',
                HTTP_IDEMPOTENCY_KEY='clean-template-import',
            )
            second = self.client.post(
                reverse('cv-v2-import'),
                payload,
                format='multipart',
                HTTP_IDEMPOTENCY_KEY='clean-template-import',
            )

        self.assertEqual(first.status_code, 202, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data['public_id'], second.data['public_id'])
        self.assertEqual(CvImportJob.objects.count(), 1)
        source = UploadAsset.objects.get(source_session=session)
        self.assertEqual(source.claim_reference, first.data['public_id'])

    def test_import_rejects_unscanned_cross_owner_and_raw_sources_when_required(self):
        pending = create_upload_session(
            owner=self.candidate,
            purpose='candidate_cv',
            original_filename='pending.pdf',
            content_type='application/pdf',
            expected_size_bytes=20,
        )
        pending_response = self.client.post(
            reverse('cv-v2-import'),
            {'upload_session': pending.public_id},
            format='multipart',
        )
        self.assertEqual(pending_response.status_code, 409)
        self.assertEqual(pending_response.data['code'], 'UPLOAD_NOT_CLEAN')
        self.assertEqual(UserCv.objects.count(), 0)

        foreign = create_upload_session(
            owner=self.other_candidate,
            purpose='candidate_cv',
            original_filename='foreign.pdf',
            content_type='application/pdf',
            expected_size_bytes=20,
        )
        foreign_response = self.client.post(
            reverse('cv-v2-import'),
            {'upload_session': foreign.public_id},
            format='multipart',
        )
        self.assertEqual(foreign_response.status_code, 404)
        self.assertEqual(foreign_response.data['code'], 'RESOURCE_NOT_FOUND')

        raw = SimpleUploadedFile('legacy.pdf', b'%PDF-1.7\nlegacy', content_type='application/pdf')
        with (
            override_settings(CANDIDATE_UPLOAD_SESSION_REQUIRED=True),
            patch('apps.cvs.api.views.v2.validate_import_upload') as validate_raw,
        ):
            raw_response = self.client.post(
                reverse('cv-v2-import'),
                {'file': raw},
                format='multipart',
            )
        self.assertEqual(raw_response.status_code, 409)
        self.assertEqual(raw_response.data['code'], 'UPLOAD_SESSION_REQUIRED')
        validate_raw.assert_not_called()

    def test_avatar_is_decoded_only_after_clean_claim(self):
        buffer = BytesIO()
        Image.new('RGB', (900, 700), '#2255AA').save(buffer, format='JPEG')
        session = self.create_clean_session(
            SimpleUploadedFile('avatar.jpg', buffer.getvalue(), content_type='image/jpeg')
        )

        response = self.client.post(
            reverse('cv-v2-asset-upload'),
            {'upload_session': session.public_id},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        avatar = CvAsset.objects.get(public_id=response.data['public_id'])
        source = UploadAsset.objects.get(source_session=session)
        self.assertEqual(source.claim_scope, CV_AVATAR_CLAIM_SCOPE)
        self.assertEqual(source.claim_reference, avatar.public_id)
        self.assertLessEqual(avatar.width, 512)
        self.assertLessEqual(avatar.height, 512)

    def test_structurally_invalid_clean_avatar_rolls_back_the_claim(self):
        session = self.create_clean_session(
            SimpleUploadedFile(
                'broken.png',
                b'\x89PNG\r\n\x1a\nnot-an-image',
                content_type='image/png',
            )
        )

        response = self.client.post(
            reverse('cv-v2-asset-upload'),
            {'upload_session': session.public_id},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        source = UploadAsset.objects.get(source_session=session)
        self.assertIsNone(source.claimed_at)
        self.assertEqual(CvAsset.objects.count(), 0)

    def test_hard_delete_releases_claim_without_deleting_retained_evidence(self):
        session = self.create_clean_session(
            SimpleUploadedFile(
                'retained.pdf', b'%PDF-1.7\nretained', content_type='application/pdf'
            )
        )
        imported = self.client.post(
            reverse('cv-v2-import'),
            {'upload_session': session.public_id},
            format='multipart',
        )
        source = UploadAsset.objects.get(source_session=session)

        deleted = self.client.delete(
            reverse('cv-v2-detail', kwargs={'public_id': imported.data['public_id']})
        )

        self.assertEqual(deleted.status_code, 204)
        source.refresh_from_db()
        self.assertIsNotNone(source.released_at)
        self.assertEqual(source.release_reason_code, 'candidate_cv_source_released')
        self.assertTrue(source.storage_key)
        self.assertIsNone(source.deleted_at)

    def test_import_source_expiry_releases_clean_asset_instead_of_deleting_it(self):
        session = self.create_clean_session(
            SimpleUploadedFile(
                'expiring.pdf', b'%PDF-1.7\nexpiring', content_type='application/pdf'
            )
        )
        imported = self.client.post(
            reverse('cv-v2-import'),
            {'upload_session': session.public_id},
            format='multipart',
        )
        cv = UserCv.objects.get(public_id=imported.data['public_id'])
        source = UploadAsset.objects.get(source_session=session)
        CvImportJob.objects.create(
            cv=cv,
            user=self.candidate,
            idempotency_key='expiry-test',
            file_checksum_sha256=source.checksum_sha256,
            status=CvImportJob.Status.COMPLETED,
            source_expires_at=timezone.now() - timedelta(seconds=1),
        )

        purge_expired_cv_import_sources()

        cv.refresh_from_db()
        source.refresh_from_db()
        self.assertEqual(cv.file_url, '')
        self.assertIsNotNone(source.released_at)
        self.assertTrue(source.storage_key)
        self.assertIsNone(source.deleted_at)
