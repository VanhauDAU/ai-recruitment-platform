import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import storages
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.uploads.models import (
    UploadAsset,
    UploadScanAttempt,
    UploadScanAttemptStatus,
    UploadSession,
    UploadState,
    UploadTrustStatus,
)
from apps.uploads.services import (
    UploadServiceError,
    cancel_upload_session,
    claim_clean_upload,
    cleanup_upload_objects,
    create_upload_session,
    expire_stale_upload_sessions,
    place_upload_legal_hold,
    process_upload_scan,
    purge_expired_upload_evidence,
    register_legacy_trusted_asset,
    release_claimed_upload,
    request_scan_retry,
    store_quarantined_upload,
)
from apps.uploads.tests.fakes import FakeUploadScanner, TimeoutUploadScanner
from apps.uploads.tests.helpers import (
    EICAR_PDF_BYTES,
    PDF_BYTES,
    TemporaryUploadStorageMixin,
    docx_bytes,
    docx_upload,
    mark_zip_encrypted,
    pdf_upload,
    zip_symlink_info,
)


class UploadPipelineTests(TemporaryUploadStorageMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.owner = get_user_model().objects.create_user(
            email='upload-owner@example.com',
            password='Password@123',
            role='employer',
        )

    def create_and_store(
        self, payload=PDF_BYTES, *, purpose='employer_verification', name='document.pdf'
    ):
        session = create_upload_session(
            owner=self.owner,
            purpose=purpose,
            original_filename=name,
            content_type='application/pdf',
            expected_size_bytes=len(payload),
        )
        return store_quarantined_upload(
            owner=self.owner,
            public_id=session.public_id,
            upload=pdf_upload(payload, name=name),
        )

    def test_clean_scan_creates_private_unclaimed_asset_and_deletes_quarantine(self):
        session = self.create_and_store()
        quarantine_key = session.quarantine_storage_key

        outcome = process_upload_scan(session.pk, scanner=FakeUploadScanner())

        session.refresh_from_db()
        asset = UploadAsset.objects.get(source_session=session)
        self.assertEqual(outcome.state, UploadState.CLEAN)
        self.assertEqual(session.state, UploadState.CLEAN)
        self.assertEqual(asset.trust_status, UploadTrustStatus.CLEAN)
        self.assertIsNone(asset.claimed_at)
        self.assertFalse(storages['quarantine'].exists(quarantine_key))
        self.assertTrue(storages['private_media'].exists(asset.storage_key))
        self.assertEqual(UploadScanAttempt.objects.get().status, UploadScanAttemptStatus.CLEAN)

    def test_malware_is_rejected_and_bytes_are_deleted_after_redacted_evidence(self):
        session = self.create_and_store(EICAR_PDF_BYTES, name='secret-customer-name.pdf')
        quarantine_key = session.quarantine_storage_key

        outcome = process_upload_scan(session.pk, scanner=FakeUploadScanner())

        session.refresh_from_db()
        attempt = UploadScanAttempt.objects.get(session=session)
        evidence_blob = json.dumps(
            {
                'session': session.threat_signature_sha256,
                'attempt': attempt.threat_signature_sha256,
                'result': attempt.result_code,
            }
        )
        self.assertEqual(outcome.state, UploadState.REJECTED)
        self.assertEqual(session.state, UploadState.REJECTED)
        self.assertFalse(UploadAsset.objects.filter(source_session=session).exists())
        self.assertFalse(storages['quarantine'].exists(quarantine_key))
        self.assertNotIn('Eicar-Test-Signature', evidence_blob)
        self.assertNotIn('secret-customer-name.pdf', evidence_blob)
        self.assertEqual(len(session.threat_signature_sha256), 64)

    def test_timeout_fails_closed_then_owner_can_retry_within_attempt_budget(self):
        session = self.create_and_store()

        with self.assertLogs('apps.uploads.services.pipeline', level='WARNING') as logs:
            failed = process_upload_scan(session.pk, scanner=TimeoutUploadScanner())
        session.refresh_from_db()
        self.assertEqual(failed.state, UploadState.ERROR)
        self.assertEqual(session.state, UploadState.ERROR)
        self.assertFalse(UploadAsset.objects.filter(source_session=session).exists())
        self.assertNotIn(session.original_filename, '\n'.join(logs.output))
        self.assertNotIn(session.quarantine_storage_key, '\n'.join(logs.output))

        request_scan_retry(owner=self.owner, public_id=session.public_id)
        recovered = process_upload_scan(session.pk, scanner=FakeUploadScanner())
        session.refresh_from_db()
        self.assertEqual(recovered.state, UploadState.CLEAN)
        self.assertEqual(session.scan_attempts, 2)

    @override_settings(UPLOAD_SCAN_MAX_ATTEMPTS=1)
    def test_attempt_budget_exhaustion_remains_error_and_cannot_attach(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=TimeoutUploadScanner())

        with self.assertRaises(UploadServiceError) as retry_error:
            request_scan_retry(owner=self.owner, public_id=session.public_id)
        with self.assertRaises(UploadServiceError) as claim_error:
            claim_clean_upload(
                owner=self.owner,
                public_id=session.public_id,
                expected_purpose='employer_verification',
                claim_scope='verification_case',
                claim_reference='case_1',
            )

        self.assertEqual(retry_error.exception.code, 'UPLOAD_SCAN_FAILED')
        self.assertEqual(claim_error.exception.code, 'UPLOAD_NOT_CLEAN')

    def test_claim_is_purpose_bound_and_idempotent_only_for_same_domain_reference(self):
        session = self.create_and_store(purpose='employer_verification')
        process_upload_scan(session.pk, scanner=FakeUploadScanner())

        with self.assertRaises(UploadServiceError) as mismatch:
            claim_clean_upload(
                owner=self.owner,
                public_id=session.public_id,
                expected_purpose='candidate_cv',
                claim_scope='candidate_cv',
                claim_reference='cv_1',
            )
        self.assertEqual(mismatch.exception.code, 'UPLOAD_PURPOSE_MISMATCH')

        asset = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_1',
        )
        repeated = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_1',
        )
        self.assertEqual(asset.pk, repeated.pk)
        with self.assertRaises(UploadServiceError) as duplicate:
            claim_clean_upload(
                owner=self.owner,
                public_id=session.public_id,
                expected_purpose='employer_verification',
                claim_scope='verification_case',
                claim_reference='case_2',
            )
        self.assertEqual(duplicate.exception.code, 'UPLOAD_ALREADY_SUBMITTED')

    def test_claimed_asset_survives_session_ttl_until_explicit_release_and_retention(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_retained',
        )
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(days=1)
        )

        self.assertEqual(expire_stale_upload_sessions(), 0)
        session.refresh_from_db()
        asset.refresh_from_db()
        self.assertEqual(session.state, UploadState.CLEAN)
        self.assertTrue(storages['private_media'].exists(asset.storage_key))

        release_claimed_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_retained',
            reason_code='business_record_closed',
        )
        self.assertEqual(expire_stale_upload_sessions(), 0)
        asset.refresh_from_db()
        self.assertTrue(storages['private_media'].exists(asset.storage_key))

        UploadAsset.objects.filter(pk=asset.pk).update(
            retained_until=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(expire_stale_upload_sessions(), 1)
        asset.refresh_from_db()
        self.assertEqual(asset.storage_key, '')
        self.assertIsNotNone(asset.deleted_at)

    @override_settings(UPLOAD_OWNER_MAX_ACTIVE_SESSIONS=1)
    def test_claimed_clean_asset_does_not_consume_temporary_session_quota(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_quota',
        )

        next_session = create_upload_session(
            owner=self.owner,
            purpose='employer_verification',
            original_filename='next.pdf',
            content_type='application/pdf',
            expected_size_bytes=len(PDF_BYTES),
        )

        self.assertEqual(next_session.state, UploadState.UPLOADING)

    def test_cleanup_never_deletes_an_unreleased_claim_even_if_state_is_expired(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_force_expired',
        )
        UploadSession.objects.filter(pk=session.pk).update(state=UploadState.EXPIRED)

        self.assertEqual(cleanup_upload_objects(session_ids=[session.pk]), 0)

        asset.refresh_from_db()
        self.assertTrue(storages['private_media'].exists(asset.storage_key))

    def test_unclaimed_clean_session_expires_and_deletes_private_bytes(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = UploadAsset.objects.get(source_session=session)
        key = asset.storage_key
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        self.assertEqual(expire_stale_upload_sessions(), 1)

        session.refresh_from_db()
        asset.refresh_from_db()
        self.assertEqual(session.state, UploadState.EXPIRED)
        self.assertEqual(asset.storage_key, '')
        self.assertFalse(storages['private_media'].exists(key))

    @override_settings(UPLOAD_OWNER_MAX_ACTIVE_SESSIONS=1)
    def test_failed_private_delete_retains_reference_and_quota_until_retry(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = UploadAsset.objects.get(source_session=session)
        key = asset.storage_key
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        with (
            patch('apps.uploads.services.pipeline.private_media_storage') as storage_factory,
            self.assertLogs('apps.uploads.services.pipeline', level='WARNING'),
        ):
            storage_factory.return_value.delete.side_effect = OSError('provider detail')
            self.assertEqual(expire_stale_upload_sessions(), 1)

        asset.refresh_from_db()
        self.assertEqual(asset.storage_key, key)
        self.assertIsNone(asset.deleted_at)
        with self.assertRaises(UploadServiceError) as blocked:
            create_upload_session(
                owner=self.owner,
                purpose='employer_verification',
                original_filename='blocked-by-private-residue.pdf',
                content_type='application/pdf',
                expected_size_bytes=len(PDF_BYTES),
            )
        self.assertEqual(blocked.exception.code, 'UPLOAD_SESSION_QUOTA_EXCEEDED')

        self.assertEqual(cleanup_upload_objects(session_ids=[session.pk]), 1)
        asset.refresh_from_db()
        self.assertEqual(asset.storage_key, '')
        recovered = create_upload_session(
            owner=self.owner,
            purpose='employer_verification',
            original_filename='after-private-cleanup.pdf',
            content_type='application/pdf',
            expected_size_bytes=len(PDF_BYTES),
        )
        self.assertEqual(recovered.state, UploadState.UPLOADING)

    @override_settings(UPLOAD_OWNER_MAX_ACTIVE_SESSIONS=1)
    def test_failed_quarantine_delete_retains_quota_until_cleanup_succeeds(self):
        session = self.create_and_store()
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        with (
            patch('apps.uploads.services.pipeline.quarantine_storage') as storage_factory,
            self.assertLogs('apps.uploads.services.pipeline', level='WARNING'),
        ):
            storage_factory.return_value.delete.side_effect = OSError('provider detail')
            self.assertEqual(expire_stale_upload_sessions(), 1)

        session.refresh_from_db()
        self.assertEqual(session.state, UploadState.EXPIRED)
        self.assertTrue(session.quarantine_storage_key)
        with self.assertRaises(UploadServiceError) as blocked:
            create_upload_session(
                owner=self.owner,
                purpose='employer_verification',
                original_filename='blocked-by-quarantine-residue.pdf',
                content_type='application/pdf',
                expected_size_bytes=len(PDF_BYTES),
            )
        self.assertEqual(blocked.exception.code, 'UPLOAD_SESSION_QUOTA_EXCEEDED')

        self.assertEqual(cleanup_upload_objects(session_ids=[session.pk]), 1)
        session.refresh_from_db()
        self.assertEqual(session.quarantine_storage_key, '')
        recovered = create_upload_session(
            owner=self.owner,
            purpose='employer_verification',
            original_filename='after-quarantine-cleanup.pdf',
            content_type='application/pdf',
            expected_size_bytes=len(PDF_BYTES),
        )
        self.assertEqual(recovered.state, UploadState.UPLOADING)

    def test_legal_hold_wins_over_release_retention_and_cleanup(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_hold',
        )
        release_claimed_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_hold',
            reason_code='business_record_closed',
        )
        UploadAsset.objects.filter(pk=asset.pk).update(
            retained_until=timezone.now() - timedelta(days=1)
        )
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
        place_upload_legal_hold(asset_public_id=asset.public_id, reason_code='litigation_hold')

        self.assertEqual(expire_stale_upload_sessions(), 0)
        self.assertEqual(cleanup_upload_objects(session_ids=[session.pk]), 0)
        asset.refresh_from_db()
        self.assertTrue(storages['private_media'].exists(asset.storage_key))

    def test_cancel_is_idempotent_and_removes_quarantine_bytes(self):
        session = self.create_and_store()
        key = session.quarantine_storage_key

        cancelled = cancel_upload_session(owner=self.owner, public_id=session.public_id)
        repeated = cancel_upload_session(owner=self.owner, public_id=session.public_id)

        self.assertEqual(cancelled.state, UploadState.EXPIRED)
        self.assertEqual(repeated.state, UploadState.EXPIRED)
        self.assertFalse(storages['quarantine'].exists(key))

    def test_legacy_registration_records_no_fake_scan_evidence(self):
        requested_retention = timezone.now() + timedelta(days=1)
        asset = register_legacy_trusted_asset(
            owner=self.owner,
            purpose='employer_verification',
            original_filename='legacy-license.pdf',
            content_type='application/pdf',
            size_bytes=123,
            storage_key='employers/legacy/license.pdf',
            claim_scope='verification_document',
            claim_reference='doc_legacy',
            retained_until=requested_retention,
        )

        self.assertEqual(asset.trust_status, UploadTrustStatus.LEGACY_TRUSTED)
        self.assertEqual(asset.checksum_sha256, '')
        self.assertIsNone(asset.source_session)
        self.assertEqual(UploadScanAttempt.objects.count(), 0)
        self.assertGreaterEqual(asset.retained_until, requested_retention + timedelta(days=728))

    def test_terminal_evidence_purges_only_after_bytes_are_gone_and_deadline_passes(self):
        session = self.create_and_store(EICAR_PDF_BYTES)
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        UploadSession.objects.filter(pk=session.pk).update(
            evidence_retained_until=timezone.now() - timedelta(seconds=1)
        )

        self.assertEqual(purge_expired_upload_evidence(), 1)
        self.assertFalse(UploadSession.objects.filter(pk=session.pk).exists())
        self.assertEqual(UploadScanAttempt.objects.count(), 0)

    def test_clean_unclaimed_asset_metadata_is_scrubbed_at_evidence_deadline(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = UploadAsset.objects.get(source_session=session)
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1),
            evidence_retained_until=timezone.now() - timedelta(seconds=1),
        )

        self.assertEqual(expire_stale_upload_sessions(), 1)
        self.assertEqual(purge_expired_upload_evidence(), 1)

        asset.refresh_from_db()
        self.assertFalse(UploadSession.objects.filter(pk=session.pk).exists())
        self.assertIsNone(asset.owner_id)
        self.assertIsNone(asset.source_session_id)
        self.assertEqual(asset.original_filename, '')
        self.assertEqual(asset.checksum_sha256, '')
        self.assertEqual(asset.purpose, '')
        self.assertEqual(asset.content_type, '')
        self.assertEqual(asset.size_bytes, 0)

    def test_released_asset_claim_metadata_is_scrubbed_after_retention_and_evidence(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_private_reference',
        )
        release_claimed_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_private_reference',
            reason_code='business_record_closed',
        )
        UploadAsset.objects.filter(pk=asset.pk).update(
            retained_until=timezone.now() - timedelta(seconds=1)
        )
        UploadSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1),
            evidence_retained_until=timezone.now() - timedelta(seconds=1),
        )

        self.assertEqual(expire_stale_upload_sessions(), 1)
        self.assertEqual(purge_expired_upload_evidence(), 1)

        asset.refresh_from_db()
        self.assertEqual(asset.claim_scope, '')
        self.assertEqual(asset.claim_reference, '')
        self.assertIsNone(asset.claimed_at)
        self.assertIsNone(asset.released_at)
        self.assertEqual(asset.release_reason_code, '')

    def test_unreleased_claim_prevents_evidence_and_asset_metadata_purge(self):
        session = self.create_and_store()
        process_upload_scan(session.pk, scanner=FakeUploadScanner())
        asset = claim_clean_upload(
            owner=self.owner,
            public_id=session.public_id,
            expected_purpose='employer_verification',
            claim_scope='verification_case',
            claim_reference='case_active_reference',
        )
        UploadSession.objects.filter(pk=session.pk).update(
            state=UploadState.EXPIRED,
            evidence_retained_until=timezone.now() - timedelta(seconds=1),
            quarantine_storage_key='',
        )
        UploadAsset.objects.filter(pk=asset.pk).update(
            storage_key='',
            deleted_at=timezone.now(),
        )

        self.assertEqual(purge_expired_upload_evidence(), 0)

        session.refresh_from_db()
        asset.refresh_from_db()
        self.assertEqual(asset.claim_reference, 'case_active_reference')
        self.assertEqual(asset.original_filename, 'document.pdf')

    def _docx_session(self, payload):
        return create_upload_session(
            owner=self.owner,
            purpose='employer_verification',
            original_filename='document.docx',
            content_type=(
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ),
            expected_size_bytes=len(payload),
        )

    def test_valid_docx_container_enters_quarantine_without_pre_scan_extraction(self):
        payload = docx_bytes()
        session = self._docx_session(payload)

        stored = store_quarantined_upload(
            owner=self.owner,
            public_id=session.public_id,
            upload=docx_upload(payload),
        )

        self.assertEqual(stored.state, UploadState.QUARANTINED)

    def test_generic_zip_and_path_traversal_are_rejected_as_docx(self):
        generic = docx_bytes(
            extra_entries=[('generic.txt', b'data')],
            include_required=False,
        )
        traversal = docx_bytes(extra_entries=[('../escape.bin', b'payload')])

        for payload in (generic, traversal):
            session = self._docx_session(payload)
            with self.assertRaises(UploadServiceError) as rejected:
                store_quarantined_upload(
                    owner=self.owner,
                    public_id=session.public_id,
                    upload=docx_upload(payload),
                )
            self.assertEqual(rejected.exception.code, 'UPLOAD_CONTENT_MISMATCH')
            session.refresh_from_db()
            self.assertEqual(session.state, UploadState.UPLOADING)

    @override_settings(UPLOAD_DOCX_MAX_COMPRESSION_RATIO=2)
    def test_high_compression_ratio_docx_is_rejected_before_scanner(self):
        payload = docx_bytes(document=b'A' * 100_000)
        session = self._docx_session(payload)

        with self.assertRaises(UploadServiceError) as rejected:
            store_quarantined_upload(
                owner=self.owner,
                public_id=session.public_id,
                upload=docx_upload(payload),
            )

        self.assertEqual(rejected.exception.code, 'UPLOAD_CONTENT_MISMATCH')
        self.assertEqual(UploadScanAttempt.objects.filter(session=session).count(), 0)

    @override_settings(UPLOAD_DOCX_MAX_UNCOMPRESSED_BYTES=10)
    def test_oversized_uncompressed_docx_is_rejected(self):
        payload = docx_bytes(document=b'<w:document>large</w:document>')
        session = self._docx_session(payload)

        with self.assertRaises(UploadServiceError) as rejected:
            store_quarantined_upload(
                owner=self.owner,
                public_id=session.public_id,
                upload=docx_upload(payload),
            )

        self.assertEqual(rejected.exception.code, 'UPLOAD_CONTENT_MISMATCH')

    def test_encrypted_docx_container_is_rejected_without_reading_entries(self):
        payload = mark_zip_encrypted(docx_bytes())
        session = self._docx_session(payload)

        with self.assertRaises(UploadServiceError) as rejected:
            store_quarantined_upload(
                owner=self.owner,
                public_id=session.public_id,
                upload=docx_upload(payload),
            )

        self.assertEqual(rejected.exception.code, 'UPLOAD_CONTENT_MISMATCH')

    def test_docx_symlink_entry_is_rejected(self):
        payload = docx_bytes(extra_entries=[(zip_symlink_info(), b'word/document.xml')])
        session = self._docx_session(payload)

        with self.assertRaises(UploadServiceError) as rejected:
            store_quarantined_upload(
                owner=self.owner,
                public_id=session.public_id,
                upload=docx_upload(payload),
            )

        self.assertEqual(rejected.exception.code, 'UPLOAD_CONTENT_MISMATCH')

    @override_settings(UPLOAD_DOCX_MAX_ENTRIES=2)
    def test_docx_entry_count_is_bounded_before_scanner(self):
        payload = docx_bytes(extra_entries=[('word/styles.xml', b'<w:styles/>')])
        session = self._docx_session(payload)

        with self.assertRaises(UploadServiceError) as rejected:
            store_quarantined_upload(
                owner=self.owner,
                public_id=session.public_id,
                upload=docx_upload(payload),
            )

        self.assertEqual(rejected.exception.code, 'UPLOAD_CONTENT_MISMATCH')
        self.assertEqual(UploadScanAttempt.objects.filter(session=session).count(), 0)
