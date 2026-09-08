import os
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.core.files.storage import storages
from django.test import TestCase

from apps.uploads.models import UploadAsset, UploadState
from apps.uploads.services import (
    ClamAVStreamScanner,
    create_upload_session,
    process_upload_scan,
    store_quarantined_upload,
)
from apps.uploads.tests.helpers import (
    PDF_BYTES,
    TemporaryUploadStorageMixin,
    docx_bytes,
    docx_upload,
    pdf_upload,
)

EICAR_TEST_BYTES = b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'


@skipUnless(
    os.environ.get('RUN_REAL_CLAMAV_TESTS') == '1',
    'Set RUN_REAL_CLAMAV_TESTS=1 only when a real isolated ClamAV daemon is ready.',
)
class RealClamAVPipelineTests(TemporaryUploadStorageMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.owner = get_user_model().objects.create_user(
            email='real-clamav-candidate@example.com',
            password='Password@123',
            role='candidate',
        )

    def create_and_store(self, payload, *, name):
        session = create_upload_session(
            owner=self.owner,
            purpose='candidate_cv',
            original_filename=name,
            content_type='application/pdf',
            expected_size_bytes=len(payload),
        )
        return store_quarantined_upload(
            owner=self.owner,
            public_id=session.public_id,
            upload=pdf_upload(payload, name=name),
        )

    def create_and_store_docx(self, payload, *, name):
        content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        session = create_upload_session(
            owner=self.owner,
            purpose='candidate_cv',
            original_filename=name,
            content_type=content_type,
            expected_size_bytes=len(payload),
        )
        return store_quarantined_upload(
            owner=self.owner,
            public_id=session.public_id,
            upload=docx_upload(payload, name=name),
        )

    def test_real_clamav_promotes_clean_candidate_pdf(self):
        session = self.create_and_store(PDF_BYTES, name='clean-candidate.pdf')
        quarantine_key = session.quarantine_storage_key

        outcome = process_upload_scan(session.pk, scanner=ClamAVStreamScanner())

        session.refresh_from_db()
        asset = UploadAsset.objects.get(source_session=session)
        self.assertEqual(outcome.state, UploadState.CLEAN)
        self.assertEqual(session.state, UploadState.CLEAN)
        self.assertFalse(storages['quarantine'].exists(quarantine_key))
        self.assertTrue(storages['private_media'].exists(asset.storage_key))

    def test_real_clamav_rejects_eicar_and_removes_quarantine_bytes(self):
        payload = docx_bytes(document=EICAR_TEST_BYTES)
        session = self.create_and_store_docx(payload, name='eicar-candidate.docx')
        quarantine_key = session.quarantine_storage_key

        outcome = process_upload_scan(session.pk, scanner=ClamAVStreamScanner())

        session.refresh_from_db()
        self.assertEqual(outcome.state, UploadState.REJECTED)
        self.assertEqual(session.state, UploadState.REJECTED)
        self.assertFalse(UploadAsset.objects.filter(source_session=session).exists())
        self.assertFalse(storages['quarantine'].exists(quarantine_key))
        self.assertEqual(len(session.threat_signature_sha256), 64)
