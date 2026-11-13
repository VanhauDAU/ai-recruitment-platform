from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import storages
from django.db import close_old_connections
from django.test import TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone

from apps.uploads.models import UploadAsset, UploadScanAttempt, UploadSession, UploadState
from apps.uploads.services import (
    ScannerResult,
    ScannerVerdict,
    UploadServiceError,
    create_upload_session,
    process_upload_scan,
    store_quarantined_upload,
)
from apps.uploads.tests.fakes import FakeUploadScanner
from apps.uploads.tests.helpers import PDF_BYTES, TemporaryUploadStorageMixin, pdf_upload


class BlockingCleanScanner:
    def __init__(self, started, release):
        self.started = started
        self.release = release

    def scan(self, stream):
        stream.read()
        self.started.set()
        if not self.release.wait(timeout=10):
            raise TimeoutError
        return ScannerResult(verdict=ScannerVerdict.CLEAN, revision='blocking-fake-v1')


class UploadScanConcurrencyTests(TemporaryUploadStorageMixin, TransactionTestCase):
    reset_sequences = True

    def test_duplicate_workers_create_one_attempt_and_one_asset(self):
        owner = get_user_model().objects.create_user(
            email='upload-concurrency@example.com',
            password='Password@123',
            role='employer',
        )
        session = create_upload_session(
            owner=owner,
            purpose='employer_verification',
            original_filename='concurrent.pdf',
            content_type='application/pdf',
            expected_size_bytes=len(PDF_BYTES),
        )
        session = store_quarantined_upload(
            owner=owner,
            public_id=session.public_id,
            upload=pdf_upload(PDF_BYTES, name='concurrent.pdf'),
        )
        started = Event()
        release = Event()

        def scan_once():
            close_old_connections()
            try:
                return process_upload_scan(
                    session.pk,
                    scanner=BlockingCleanScanner(started, release),
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=1) as executor:
            first_future = executor.submit(scan_once)
            self.assertTrue(started.wait(timeout=5))
            duplicate = process_upload_scan(
                session.pk,
                scanner=BlockingCleanScanner(Event(), Event()),
            )
            release.set()
            first = first_future.result(timeout=10)

        self.assertEqual(duplicate.state, 'busy')
        self.assertEqual(first.state, UploadState.CLEAN)
        self.assertEqual(UploadScanAttempt.objects.filter(session=session).count(), 1)
        self.assertEqual(UploadAsset.objects.filter(source_session=session).count(), 1)

    def test_stale_worker_cannot_delete_newer_attempt_clean_asset(self):
        owner = get_user_model().objects.create_user(
            email='upload-stale-worker@example.com',
            password='Password@123',
            role='employer',
        )
        session = create_upload_session(
            owner=owner,
            purpose='employer_verification',
            original_filename='stale.pdf',
            content_type='application/pdf',
            expected_size_bytes=len(PDF_BYTES),
        )
        session = store_quarantined_upload(
            owner=owner,
            public_id=session.public_id,
            upload=pdf_upload(PDF_BYTES, name='stale.pdf'),
        )
        started = Event()
        release = Event()

        def stale_scan():
            close_old_connections()
            try:
                return process_upload_scan(
                    session.pk,
                    scanner=BlockingCleanScanner(started, release),
                )
            finally:
                close_old_connections()

        with patch('apps.uploads.services.pipeline._cleanup_terminal_upload', return_value=0):
            with ThreadPoolExecutor(max_workers=1) as executor:
                stale_future = executor.submit(stale_scan)
                self.assertTrue(started.wait(timeout=5))
                UploadSession.objects.filter(pk=session.pk).update(
                    scan_lease_until=timezone.now() - timedelta(seconds=1)
                )
                current = process_upload_scan(session.pk, scanner=FakeUploadScanner())
                release.set()
                stale = stale_future.result(timeout=10)

        asset = UploadAsset.objects.get(source_session=session)
        self.assertEqual(current.state, UploadState.CLEAN)
        self.assertEqual(stale.result_code, 'scan_superseded')
        self.assertTrue(
            asset.storage_key.endswith(UploadScanAttempt.objects.last().lease_token.hex)
        )
        self.assertTrue(storages['private_media'].exists(asset.storage_key))
        self.assertEqual(UploadAsset.objects.filter(source_session=session).count(), 1)
        self.assertEqual(UploadScanAttempt.objects.filter(session=session).count(), 2)


class UploadSessionQuotaConcurrencyTests(TemporaryUploadStorageMixin, TransactionTestCase):
    reset_sequences = True

    @override_settings(UPLOAD_OWNER_MAX_ACTIVE_SESSIONS=1)
    @skipUnlessDBFeature('has_select_for_update')
    def test_owner_row_lock_prevents_concurrent_active_session_quota_bypass(self):
        owner = get_user_model().objects.create_user(
            email='upload-quota-concurrency@example.com',
            password='Password@123',
            role='employer',
        )
        barrier = Barrier(2)

        def create_once(index):
            close_old_connections()
            try:
                local_owner = get_user_model().objects.get(pk=owner.pk)
                barrier.wait(timeout=5)
                try:
                    session = create_upload_session(
                        owner=local_owner,
                        purpose='employer_verification',
                        original_filename=f'concurrent-{index}.pdf',
                        content_type='application/pdf',
                        expected_size_bytes=len(PDF_BYTES),
                    )
                except UploadServiceError as error:
                    return error.code
                return session.public_id
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(create_once, range(2)))

        self.assertEqual(UploadSession.objects.filter(owner=owner).count(), 1)
        self.assertEqual(outcomes.count('UPLOAD_SESSION_QUOTA_EXCEEDED'), 1)
        self.assertEqual(sum(outcome.startswith('ups_') for outcome in outcomes), 1)
